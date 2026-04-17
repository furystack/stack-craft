import type { ChildProcess } from 'child_process'
import { Injectable, Injected, type Injector, getInjectorReference } from '@furystack/inject'
import { getLogger } from '@furystack/logging'
import type { RunStatus, ServiceStateEvent } from 'common'
import { randomUUID } from 'crypto'

import { useSystemIdentityContext } from '@furystack/core'
import { ConflictError, NotFoundError } from '../utils/domain-error.js'
import { getServiceOrThrow } from '../utils/get-service-or-throw.js'
import { resolveServiceCwd } from '../utils/resolve-service-cwd.js'
import { attachProcessIO } from './process-io-attacher.js'
import { ProcessRunner } from './process-runner.js'
import { ServiceEnvResolver } from './service-env-resolver.js'
import { ServiceStatusManager } from './service-status-manager.js'
import type { TriggerContext } from './trigger-context.js'

const DEFAULT_STOP_TIMEOUT_MS = 10_000
const DEFAULT_SHUTDOWN_KILL_TIMEOUT_MS = 5_000

/** Manages starting, stopping, restarting long-running service processes and graceful shutdown */
@Injectable({ lifetime: 'singleton' })
export class ServiceLifecycleManager {
  private elevatedInjector?: Injector

  private getElevatedInjector(): Injector {
    if (!this.elevatedInjector) {
      this.elevatedInjector = useSystemIdentityContext({ injector: getInjectorReference(this) })
    }
    return this.elevatedInjector
  }

  @Injected((injector) => getLogger(injector).withScope('ServiceLifecycleManager'))
  declare private logger: ReturnType<ReturnType<typeof getLogger>['withScope']>

  @Injected(ProcessRunner)
  declare private runner: ProcessRunner

  @Injected(ServiceEnvResolver)
  declare private envResolver: ServiceEnvResolver

  @Injected(ServiceStatusManager)
  declare private statusManager: ServiceStatusManager

  public async startService(serviceId: string, trigger: TriggerContext): Promise<void> {
    const elevated = this.getElevatedInjector()
    const svc = await getServiceOrThrow(serviceId, elevated)

    if (this.runner.processes.has(serviceId) || this.runner.pendingOperations.has(serviceId)) {
      throw new ConflictError(`Service already has a running process: ${serviceId}`)
    }

    this.runner.pendingOperations.add(serviceId)
    try {
      await this.logger.information({ message: `Starting service: ${svc.displayName}` })
      await this.statusManager.updateServiceStatus(
        serviceId,
        { runStatus: 'starting' },
        'run-started',
        trigger,
        undefined,
        {
          skipHistory: true,
        },
      )

      const cwd = await resolveServiceCwd(getInjectorReference(this), svc, elevated)
      const envVars = await this.envResolver.resolveServiceEnvVars(serviceId)
      const processUid = randomUUID()
      const child = this.runner.spawnCommand(svc.runCommand, cwd, envVars)

      this.runner.processes.set(serviceId, {
        serviceId,
        process: child,
        purpose: 'run',
        processUid,
      })

      attachProcessIO(child, serviceId, this.runner)

      this.attachProcessEventHandlers(child, serviceId, svc.displayName, trigger, processUid)
    } finally {
      this.runner.pendingOperations.delete(serviceId)
    }
  }

  private attachProcessEventHandlers(
    child: ChildProcess,
    serviceId: string,
    displayName: string,
    trigger: TriggerContext,
    processUid: string,
  ): void {
    child.on('error', (err) => {
      void this.logger.error({ message: `Service error: ${displayName}`, data: { error: err } })
      void this.statusManager.updateServiceStatus(
        serviceId,
        { runStatus: 'error' },
        'run-crashed',
        trigger,
        { error: err.message },
        { processUid },
      )
      this.runner.processes.delete(serviceId)
    })

    child.on('exit', (code) => {
      const managed = this.runner.processes.get(serviceId)
      const isGracefulStop = code === 0 || managed?.stopping === true
      void this.logger.information({ message: `Service exited: ${displayName} (code ${code})` })
      const newStatus: RunStatus = isGracefulStop ? 'stopped' : 'error'
      const event: ServiceStateEvent = isGracefulStop ? 'run-stopped' : 'run-crashed'
      void this.statusManager.updateServiceStatus(
        serviceId,
        { runStatus: newStatus },
        event,
        trigger,
        { exitCode: code },
        { processUid },
      )
      this.runner.processes.delete(serviceId)
    })

    child.on('spawn', () => {
      void this.statusManager.updateServiceStatus(
        serviceId,
        { runStatus: 'running' },
        'run-started',
        trigger,
        undefined,
        {
          processUid,
        },
      )
    })
  }

  public async stopService(serviceId: string, trigger: TriggerContext): Promise<void> {
    const managed = this.runner.processes.get(serviceId)
    if (!managed || managed.purpose !== 'run') {
      throw new NotFoundError(`No running process for service: ${serviceId}`)
    }

    await this.logger.information({ message: `Stopping service: ${serviceId}` })
    managed.stopping = true
    await this.statusManager.updateServiceStatus(
      serviceId,
      { runStatus: 'stopping' },
      'run-stopped',
      trigger,
      undefined,
      {
        skipHistory: true,
      },
    )

    this.runner.killProcessGroup(managed.process, 'SIGTERM')

    await new Promise<void>((resolve) => {
      const timeout = setTimeout(
        () => {
          this.runner.killProcessGroup(managed.process, 'SIGKILL')
          resolve()
        },
        parseInt(process.env.STOP_TIMEOUT_MS as string, 10) || DEFAULT_STOP_TIMEOUT_MS,
      )

      managed.process.on('exit', () => {
        clearTimeout(timeout)
        resolve()
      })
    })
  }

  public async restartService(serviceId: string, trigger: TriggerContext): Promise<void> {
    if (this.runner.processes.has(serviceId)) {
      await this.stopService(serviceId, trigger)
    }
    await this.startService(serviceId, trigger)
  }

  /** Gracefully shuts down all running processes, escalating to SIGKILL after a timeout */
  public async shutdownAll(): Promise<void> {
    await this.logger.information({ message: 'Shutting down all child processes...' })

    const entries = [...this.runner.processes.entries()]

    const shutdownTrigger: TriggerContext = { triggeredBy: 'system', triggerSource: 'system' }
    for (const [serviceId] of entries) {
      await this.statusManager.updateServiceStatus(
        serviceId,
        { runStatus: 'stopped' },
        'run-stopped',
        shutdownTrigger,
        {
          reason: 'backend-shutdown',
        },
      )
    }

    if (entries.length > 0) {
      for (const [serviceId, managed] of entries) {
        this.runner.killProcessGroup(managed.process, 'SIGTERM')
        void this.logger.information({ message: `Sent SIGTERM to service: ${serviceId}` })
      }

      await Promise.all(
        entries.map(
          ([serviceId, managed]) =>
            new Promise<void>((resolve) => {
              const timeout = setTimeout(
                () => {
                  if (!managed.process.killed) {
                    this.runner.killProcessGroup(managed.process, 'SIGKILL')
                    void this.logger.warning({ message: `Sent SIGKILL to service: ${serviceId}` })
                  }
                  resolve()
                },
                parseInt(process.env.SHUTDOWN_KILL_TIMEOUT_MS as string, 10) || DEFAULT_SHUTDOWN_KILL_TIMEOUT_MS,
              )

              managed.process.on('exit', () => {
                clearTimeout(timeout)
                resolve()
              })
            }),
        ),
      )

      this.runner.processes.clear()
    }

    await this.runner[Symbol.asyncDispose]()
  }

  public async [Symbol.asyncDispose]() {
    await this.shutdownAll()
    try {
      await this.elevatedInjector?.[Symbol.asyncDispose]()
    } catch {
      // May already be disposed by the parent injector
    }
  }
}
