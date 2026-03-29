import type { ChildProcess } from 'child_process'
import { Injectable, Injected, type Injector, getInjectorReference } from '@furystack/inject'
import { getLogger } from '@furystack/logging'
import { getRepository } from '@furystack/repository'
import type { RunStatus, ServiceStateEvent, TriggerSource } from 'common'
import { GitHubRepository, ServiceConfig, ServiceDefinition, ServiceStatus, StackConfig, getServiceCwd } from 'common'
import { randomUUID } from 'crypto'
import { existsSync, mkdirSync, readdirSync, rmSync } from 'fs'
import { dirname, join, resolve as resolvePosix, sep } from 'path'

import { useSystemIdentityContext } from '@furystack/core'
import { applyServiceFiles, mergeServiceFiles } from '../utils/apply-service-files.js'
import { CryptoService } from '../utils/crypto-service.js'
import { ConflictError, NotFoundError, ValidationError } from '../utils/domain-error.js'
import { decryptLocalFiles } from '../utils/env-encryption-helpers.js'
import { getServiceOrThrow } from '../utils/get-service-or-throw.js'
import { resolvePath } from '../utils/resolve-path.js'
import { resolveServiceCwd } from '../utils/resolve-service-cwd.js'
import { GitHeadWatcher } from './git-head-watcher.js'
import { GitService } from './git-service.js'
import { GitWatcher } from './git-watcher.js'
import { ProcessRunner } from './process-runner.js'
import { ServiceEnvResolver } from './service-env-resolver.js'
import { ServiceStatusManager } from './service-status-manager.js'
import { computeExecutionLevels } from './service-graph-resolver.js'
import { StaleStateReconciler } from './stale-state-reconciler.js'

export type TriggerContext = {
  triggeredBy: string
  triggerSource: TriggerSource
}

/**
 * Orchestrates service lifecycle operations (start/stop/restart/install/build/clone)
 * by coordinating ProcessRunner, ServiceEnvResolver, GitService, and data stores.
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

  @Injected(GitHeadWatcher)
  declare private gitHeadWatcher: GitHeadWatcher

  @Injected(GitWatcher)
  declare private gitWatcher: GitWatcher

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

      child.stdout?.on('data', (data: Buffer) => {
        const lines = data.toString().split(/\r?\n/).filter(Boolean)
        lines.forEach((line) => this.runner.addLogLine(serviceId, 'stdout', line))
      })

      child.stderr?.on('data', (data: Buffer) => {
        const lines = data.toString().split(/\r?\n/).filter(Boolean)
        lines.forEach((line) => this.runner.addLogLine(serviceId, 'stderr', line))
      })

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
        void this.logger.information({ message: `Service exited: ${svc.displayName} (code ${code})` })
        const newStatus: RunStatus = code === 0 ? 'stopped' : 'error'
        const event: ServiceStateEvent = code === 0 ? 'run-stopped' : 'run-crashed'
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
        parseInt(process.env.STOP_TIMEOUT_MS as string, 10) || 10_000,
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

  /**
   * Clones or pulls the linked repository for a service.
   * @returns info about what happened: whether it was a clone, a pull, and whether files changed.
   */
  public async cloneOrPullService(
    serviceId: string,
    trigger: TriggerContext,
  ): Promise<{ cloned: boolean; pulled: boolean; updated: boolean }> {
    const elevated = this.getElevatedInjector()
    const repository = getRepository(elevated)

    const svc = await getServiceOrThrow(serviceId, elevated)

    const configs = await repository
      .getDataSetFor(StackConfig, 'stackName')
      .find(elevated, { filter: { stackName: { $eq: svc.stackName } }, top: 1 })
    const stackConfig = configs[0]
    if (!stackConfig) throw new NotFoundError(`Stack config not found: ${svc.stackName}`)

    let repo: GitHubRepository | null = null
    if (svc.repositoryId) {
      const repos = await repository
        .getDataSetFor(GitHubRepository, 'id')
        .find(elevated, { filter: { id: { $eq: svc.repositoryId } }, top: 1 })
      repo = repos[0] ?? null
    }
    if (!repo?.url) {
      throw new ValidationError(`No repository linked. Link a GitHub repository to enable clone/pull.`)
    }

    const cwd = resolvePath(getServiceCwd(stackConfig, svc, repo))
    const stackRoot = resolvePosix(resolvePath(stackConfig.mainDirectory))
    if (cwd !== stackRoot && !cwd.startsWith(`${stackRoot}${sep}`)) {
      throw new ValidationError(`Resolved path "${cwd}" is outside the stack directory "${stackRoot}"`)
    }

    await this.statusManager.updateServiceStatus(serviceId, { cloneStatus: 'cloning' }, 'clone-started', trigger)

    try {
      const git = getInjectorReference(this).getInstance(GitService)
      const isGitRepo = existsSync(cwd) && existsSync(join(cwd, '.git'))

      if (!existsSync(cwd)) {
        await this.logger.information({ message: `Cloning ${repo.url} into ${cwd}` })
        mkdirSync(dirname(cwd), { recursive: true })
        await git.clone(repo.url, cwd)
        await this.statusManager.updateServiceStatus(serviceId, { cloneStatus: 'cloned' }, 'clone-completed', trigger)
        await this.gitHeadWatcher.watch(serviceId, cwd)
        void this.gitWatcher.startWatching(serviceId)
        await this.applySharedFiles(svc, cwd)
        return { cloned: true, pulled: false, updated: true }
      } else if (isGitRepo) {
        await this.logger.information({ message: `Pulling in ${cwd}` })
        const { updated } = await git.pull(cwd)
        await this.statusManager.updateServiceStatus(serviceId, { cloneStatus: 'cloned' }, 'clone-completed', trigger)
        await this.gitHeadWatcher.watch(serviceId, cwd)
        void this.gitWatcher.startWatching(serviceId)
        await this.applySharedFiles(svc, cwd)
        return { cloned: false, pulled: true, updated }
      } else {
        const dirContents = readdirSync(cwd)
        if (dirContents.length > 0) {
          await this.logger.warning({
            message: `Directory "${cwd}" exists with ${dirContents.length} entries but is not a git repo. Removing and re-cloning.`,
          })
        }
        rmSync(cwd, { recursive: true })
        mkdirSync(dirname(cwd), { recursive: true })
        await git.clone(repo.url, cwd)
        await this.statusManager.updateServiceStatus(serviceId, { cloneStatus: 'cloned' }, 'clone-completed', trigger)
        await this.gitHeadWatcher.watch(serviceId, cwd)
        void this.gitWatcher.startWatching(serviceId)
        await this.applySharedFiles(svc, cwd)
        return { cloned: true, pulled: false, updated: true }
      }
    } catch (error) {
      await this.statusManager.updateServiceStatus(serviceId, { cloneStatus: 'failed' }, 'clone-failed', trigger, {
        error: error instanceof Error ? error.message : 'Unknown clone/pull error',
      })
      throw error
    }
  }

  private async applySharedFiles(svc: ServiceDefinition, cwd: string): Promise<void> {
    const elevated = this.getElevatedInjector()
    const crypto = elevated.getInstance(CryptoService)

    const svcConfigs = await getRepository(elevated)
      .getDataSetFor(ServiceConfig, 'serviceId')
      .find(elevated, { filter: { serviceId: { $eq: svc.id } }, top: 1 })
    const localFiles = decryptLocalFiles(crypto, svcConfigs[0]?.localFiles ?? [])
    const sharedFiles = svc.files ?? []

    const merged = mergeServiceFiles(sharedFiles, localFiles)
    if (merged.length === 0) return

    try {
      const variables = await this.envResolver.resolveServiceEnvVars(svc.id)
      const applied = applyServiceFiles(cwd, merged, undefined, variables)
      void this.logger.information({
        message: `Applied ${applied.length} file(s) for ${svc.displayName}: ${applied.join(', ')}`,
      })
    } catch (error) {
      void this.logger.warning({
        message: `Failed to apply files for ${svc.displayName}: ${(error as Error).message}`,
      })
    }
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
    const allServices = await getRepository(elevated).getDataSetFor(ServiceDefinition, 'id').find(elevated, {})

    const serviceMap = new Map(allServices.map((s) => [s.id, s]))
    const targetSet = new Set(serviceIds)

    const levels = computeExecutionLevels(serviceIds, serviceMap, targetSet)

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

    child.stdout?.on('data', (data: Buffer) => {
      data
        .toString()
        .split(/\r?\n/)
        .filter(Boolean)
        .forEach((line) => this.runner.addLogLine(serviceId, 'stdout', line))
    })

    child.stderr?.on('data', (data: Buffer) => {
      data
        .toString()
        .split(/\r?\n/)
        .filter(Boolean)
        .forEach((line) => this.runner.addLogLine(serviceId, 'stderr', line))
    })

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
                parseInt(process.env.SHUTDOWN_KILL_TIMEOUT_MS as string, 10) || 5_000,
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
