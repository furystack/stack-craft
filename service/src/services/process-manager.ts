import type { ChildProcess } from 'child_process'
import { Injectable, Injected, type Injector, getInjectorReference } from '@furystack/inject'
import { getLogger } from '@furystack/logging'
import { getRepository } from '@furystack/repository'
import type { RunStatus, ServiceStateEvent, TriggerSource } from 'common'
import { ServiceConfig, ServiceDependencyLink, ServiceStatus } from 'common'
import { randomUUID } from 'crypto'

import { useSystemIdentityContext } from '@furystack/core'
import { applyServiceFiles, mergeServiceFiles } from '../utils/apply-service-files.js'
import { CryptoService } from '../utils/crypto-service.js'
import { ConflictError, NotFoundError, ValidationError } from '../utils/domain-error.js'
import { decryptLocalFiles } from '../utils/env-encryption-helpers.js'
import { getServiceOrThrow } from '../utils/get-service-or-throw.js'
import { resolveServiceCwd } from '../utils/resolve-service-cwd.js'
import { GitOperationsService } from './git-operations-service.js'
import { ProcessRunner } from './process-runner.js'
import { ServiceEnvResolver } from './service-env-resolver.js'
import { ServiceStatusManager } from './service-status-manager.js'
import { computeExecutionLevels } from './service-graph-resolver.js'
import { StaleStateReconciler } from './stale-state-reconciler.js'
import { attachProcessIO } from './process-io-attacher.js'

const DEFAULT_STOP_TIMEOUT_MS = 10_000
const DEFAULT_SHUTDOWN_KILL_TIMEOUT_MS = 5_000

export type TriggerContext = {
  triggeredBy: string
  triggerSource: TriggerSource
}

/**
 * Orchestrates service lifecycle operations (start/stop/restart/install/build/clone)
 * by coordinating ProcessRunner, ServiceEnvResolver, GitOperationsService, and data stores.
 */
@Injectable({ lifetime: 'singleton' })
export class ProcessManager {
  private elevatedInjector?: Injector

  private getElevatedInjector(): Injector {
    if (!this.elevatedInjector) {
      this.elevatedInjector = useSystemIdentityContext({ injector: getInjectorReference(this) })
    }
    return this.elevatedInjector
  }

  @Injected((injector) => getLogger(injector).withScope('ProcessManager'))
  declare private logger: ReturnType<ReturnType<typeof getLogger>['withScope']>

  @Injected(ProcessRunner)
  declare private runner: ProcessRunner

  @Injected(ServiceEnvResolver)
  declare private envResolver: ServiceEnvResolver

  @Injected(GitOperationsService)
  declare private gitOps: GitOperationsService

  @Injected(ServiceStatusManager)
  declare private statusManager: ServiceStatusManager

  @Injected(StaleStateReconciler)
  declare private reconciler: StaleStateReconciler

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

      child.on('error', (err) => {
        void this.logger.error({ message: `Service error: ${svc.displayName}`, data: { error: err } })
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
        void this.logger.information({ message: `Service exited: ${svc.displayName} (code ${code})` })
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
    } finally {
      this.runner.pendingOperations.delete(serviceId)
    }
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

  public async cloneOrPullService(
    serviceId: string,
    trigger: TriggerContext,
  ): Promise<{ cloned: boolean; pulled: boolean; updated: boolean }> {
    return this.gitOps.cloneOrPullService(serviceId, trigger)
  }

  /**
   * Manually applies shared files for a service to disk.
   * @param relativePath - If provided, only the file matching this path is applied
   * @returns The list of relative paths that were written
   */
  public async applyFiles(serviceId: string, relativePath?: string): Promise<string[]> {
    const elevated = this.getElevatedInjector()
    const crypto = elevated.getInstance(CryptoService)
    const repository = getRepository(elevated)

    const svc = await getServiceOrThrow(serviceId, elevated)

    const svcConfigs = await repository
      .getDataSetFor(ServiceConfig, 'serviceId')
      .find(elevated, { filter: { serviceId: { $eq: serviceId } }, top: 1 })
    const localFiles = decryptLocalFiles(crypto, svcConfigs[0]?.localFiles ?? [])
    const merged = mergeServiceFiles(svc.files ?? [], localFiles)

    const cwd = await resolveServiceCwd(getInjectorReference(this), svc, elevated)

    if (relativePath) {
      const file = merged.find((f) => f.relativePath === relativePath)
      if (!file) throw new NotFoundError(`File not found in service definition or local files: ${relativePath}`)
    }

    const variables = await this.envResolver.resolveServiceEnvVars(serviceId)
    return applyServiceFiles(cwd, merged, relativePath, variables)
  }

  /**
   * Runs the full setup pipeline for a service: clone -> install -> build.
   * Skips steps that don't apply (e.g. no repo, no installCommand).
   * Stops on first failure.
   */
  public async setupService(serviceId: string, trigger: TriggerContext): Promise<void> {
    const elevated = this.getElevatedInjector()
    const svc = await getServiceOrThrow(serviceId, elevated)

    await this.statusManager.updateServiceStatus(serviceId, {}, 'setup-started', trigger)

    try {
      if (svc.repositoryId) {
        const statuses = await getRepository(elevated)
          .getDataSetFor(ServiceStatus, 'serviceId')
          .find(elevated, { filter: { serviceId: { $eq: serviceId } }, top: 1 })
        const currentStatus = statuses[0]
        if (currentStatus?.cloneStatus !== 'cloned') {
          await this.cloneOrPullService(serviceId, trigger)
        }
      }

      if (svc.installCommand) {
        await this.installService(serviceId, trigger)
      }

      if (svc.buildCommand) {
        await this.buildService(serviceId, trigger)
      }

      await this.statusManager.updateServiceStatus(serviceId, {}, 'setup-completed', trigger)
    } catch (error) {
      await this.statusManager.updateServiceStatus(serviceId, {}, 'setup-failed', trigger, {
        error: error instanceof Error ? error.message : 'Setup failed',
      })
      throw error
    }
  }

  /**
   * Pulls latest changes, then re-installs, re-builds, and restarts (if it was running).
   * Skips install/build/restart if git pull reported no changes.
   */
  public async updateService(serviceId: string, trigger: TriggerContext): Promise<void> {
    const elevated = this.getElevatedInjector()
    const svc = await getServiceOrThrow(serviceId, elevated)

    const statuses = await getRepository(elevated)
      .getDataSetFor(ServiceStatus, 'serviceId')
      .find(elevated, { filter: { serviceId: { $eq: serviceId } }, top: 1 })
    const currentStatus = statuses[0]

    await this.statusManager.updateServiceStatus(serviceId, {}, 'update-started', trigger)

    try {
      if (!svc.repositoryId) {
        throw new ValidationError('No repository linked to this service')
      }

      const { updated } = await this.cloneOrPullService(serviceId, trigger)

      if (!updated) {
        await this.statusManager.updateServiceStatus(serviceId, {}, 'update-completed', trigger, {
          message: 'Already up to date',
        })
        return
      }

      const wasRunning = currentStatus?.runStatus === 'running'

      if (wasRunning) {
        await this.stopService(serviceId, trigger)
      }

      if (svc.installCommand) {
        await this.installService(serviceId, trigger)
      }

      if (svc.buildCommand) {
        await this.buildService(serviceId, trigger)
      }

      if (wasRunning) {
        await this.startService(serviceId, trigger)
      }

      await this.statusManager.updateServiceStatus(serviceId, {}, 'update-completed', trigger)
    } catch (error) {
      await this.statusManager.updateServiceStatus(serviceId, {}, 'update-failed', trigger, {
        error: error instanceof Error ? error.message : 'Update failed',
      })
      throw error
    }
  }

  /**
   * Sets up multiple services respecting prerequisite dependencies.
   * Uses topological sort to determine execution order.
   */
  public async setupServices(serviceIds: string[], trigger: TriggerContext): Promise<void> {
    const elevated = this.getElevatedInjector()
    const repository = getRepository(elevated)

    const depLinks = await repository.getDataSetFor(ServiceDependencyLink, 'id').find(elevated, {})
    const dependencyMap = new Map<string, string[]>()
    for (const link of depLinks) {
      const deps = dependencyMap.get(link.serviceId) ?? []
      deps.push(link.dependsOnServiceId)
      dependencyMap.set(link.serviceId, deps)
    }

    const targetSet = new Set(serviceIds)
    const levels = computeExecutionLevels(serviceIds, dependencyMap, targetSet)

    for (const level of levels) {
      const results = await Promise.allSettled(level.map((id) => this.setupService(id, trigger)))
      const failures = results.filter((r): r is PromiseRejectedResult => r.status === 'rejected')
      if (failures.length > 0) {
        await this.logger.warning({
          message: `${failures.length} service(s) failed setup in batch level`,
          data: { errors: failures.map((f) => (f.reason as Error).message) },
        })
      }
    }
  }

  /** Delegates to ServiceEnvResolver for backward compatibility */
  public async resolveServiceEnvVars(serviceId: string): Promise<Record<string, string>> {
    return this.envResolver.resolveServiceEnvVars(serviceId)
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

  /**
   * Resets any transient service states left over from a previous backend run.
   * Should be called once during startup, after data stores are ready.
   */
  public async reconcileStaleStates(): Promise<void> {
    await this.reconciler.reconcileStaleStates()
  }

  public async [Symbol.asyncDispose]() {
    await this.runner[Symbol.asyncDispose]()

    await this.logger.information({ message: 'Disposing ProcessManager, killing all child processes...' })

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

    try {
      await this.elevatedInjector?.[Symbol.asyncDispose]()
    } catch {
      // May already be disposed by the parent injector
    }
  }
}
