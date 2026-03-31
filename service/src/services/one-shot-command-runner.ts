import type { ChildProcess } from 'child_process'
import { Injectable, Injected, type Injector, getInjectorReference } from '@furystack/inject'
import { getLogger } from '@furystack/logging'
import type { ServiceStateEvent } from 'common'
import { randomUUID } from 'crypto'

import { useSystemIdentityContext } from '@furystack/core'
import { ConflictError, ValidationError } from '../utils/domain-error.js'
import { getServiceOrThrow } from '../utils/get-service-or-throw.js'
import { resolveServiceCwd } from '../utils/resolve-service-cwd.js'
import { attachProcessIO } from './process-io-attacher.js'
import { ProcessRunner } from './process-runner.js'
import { ServiceEnvResolver } from './service-env-resolver.js'
import { ServiceStatusManager } from './service-status-manager.js'
import type { TriggerContext } from './trigger-context.js'

/** Executes one-shot commands (install, build) for services and tracks their status */
@Injectable({ lifetime: 'singleton' })
export class OneShotCommandRunner {
  private elevatedInjector?: Injector

  private getElevatedInjector(): Injector {
    if (!this.elevatedInjector) {
      this.elevatedInjector = useSystemIdentityContext({ injector: getInjectorReference(this) })
    }
    return this.elevatedInjector
  }

  @Injected((injector) => getLogger(injector).withScope('OneShotCommandRunner'))
  declare private logger: ReturnType<ReturnType<typeof getLogger>['withScope']>

  @Injected(ProcessRunner)
  declare private runner: ProcessRunner

  @Injected(ServiceEnvResolver)
  declare private envResolver: ServiceEnvResolver

  @Injected(ServiceStatusManager)
  declare private statusManager: ServiceStatusManager

  public async installService(serviceId: string, trigger: TriggerContext): Promise<void> {
    const elevated = this.getElevatedInjector()
    const svc = await getServiceOrThrow(serviceId, elevated)
    if (!svc.installCommand) throw new ValidationError(`No install command for service: ${serviceId}`)

    const cwd = await resolveServiceCwd(getInjectorReference(this), svc, elevated)
    await this.runOneShot(serviceId, svc.installCommand, cwd, 'install', trigger)
  }

  public async buildService(serviceId: string, trigger: TriggerContext): Promise<void> {
    const elevated = this.getElevatedInjector()
    const svc = await getServiceOrThrow(serviceId, elevated)
    if (!svc.buildCommand) throw new ValidationError(`No build command for service: ${serviceId}`)

    const cwd = await resolveServiceCwd(getInjectorReference(this), svc, elevated)
    await this.runOneShot(serviceId, svc.buildCommand, cwd, 'build', trigger)
  }

  private async runOneShot(
    serviceId: string,
    command: string,
    cwd: string,
    purpose: 'install' | 'build',
    trigger: TriggerContext,
  ): Promise<void> {
    if (this.runner.processes.has(serviceId) || this.runner.pendingOperations.has(serviceId)) {
      const existing = this.runner.processes.get(serviceId)
      throw new ConflictError(
        `Service ${serviceId} already has a ${existing?.purpose ?? purpose} process running. Stop it before starting a ${purpose}.`,
      )
    }

    this.runner.pendingOperations.add(serviceId)

    const progressEvent: ServiceStateEvent = purpose === 'install' ? 'install-started' : 'build-started'
    const doneEvent: ServiceStateEvent = purpose === 'install' ? 'install-completed' : 'build-completed'
    const failedEvent: ServiceStateEvent = purpose === 'install' ? 'install-failed' : 'build-failed'

    const progressStatus =
      purpose === 'install' ? ({ installStatus: 'installing' } as const) : ({ buildStatus: 'building' } as const)

    const doneStatus =
      purpose === 'install' ? ({ installStatus: 'installed' } as const) : ({ buildStatus: 'built' } as const)

    const failedStatus =
      purpose === 'install' ? ({ installStatus: 'failed' } as const) : ({ buildStatus: 'failed' } as const)

    const processUid = randomUUID()
    await this.statusManager.updateServiceStatus(serviceId, progressStatus, progressEvent, trigger, undefined, {
      processUid,
    })

    let child: ChildProcess
    try {
      const envVars = await this.envResolver.resolveServiceEnvVars(serviceId)
      child = this.runner.spawnCommand(command, cwd, envVars)
    } catch (error) {
      this.runner.pendingOperations.delete(serviceId)
      throw error
    }

    this.runner.processes.set(serviceId, {
      serviceId,
      process: child,
      purpose,
      processUid,
    })
    this.runner.pendingOperations.delete(serviceId)

    attachProcessIO(child, serviceId, this.runner)

    return new Promise((resolve, reject) => {
      child.on('error', (err) => {
        void this.statusManager.updateServiceStatus(
          serviceId,
          failedStatus,
          failedEvent,
          trigger,
          { error: err.message },
          { processUid },
        )
        this.runner.processes.delete(serviceId)
        reject(err)
      })

      child.on('exit', (code) => {
        this.runner.processes.delete(serviceId)
        if (code === 0) {
          void this.statusManager.updateServiceStatus(serviceId, doneStatus, doneEvent, trigger, undefined, {
            processUid,
          })
          resolve()
        } else {
          void this.statusManager.updateServiceStatus(
            serviceId,
            failedStatus,
            failedEvent,
            trigger,
            { exitCode: code },
            { processUid },
          )
          reject(new Error(`${purpose} command exited with code ${code}`))
        }
      })
    })
  }

  public async [Symbol.asyncDispose]() {
    try {
      await this.elevatedInjector?.[Symbol.asyncDispose]()
    } catch {
      // May already be disposed by the parent injector
    }
  }
}
