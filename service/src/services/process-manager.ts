import { Injectable, Injected, type Injector, getInjectorReference } from '@furystack/inject'
import { getLogger } from '@furystack/logging'
import { getRepository } from '@furystack/repository'
import type { CloneStatus, InstallStatus, BuildStatus, RunStatus, ServiceStateEvent, TriggerSource } from 'common'
import { GitHubRepository, ServiceDefinition, ServiceStateHistory, ServiceStatus, StackConfig } from 'common'
import { getServiceCwd } from 'common'
import { type ChildProcess, spawn } from 'child_process'
import { existsSync, mkdirSync, readdirSync, rmSync } from 'fs'
import { randomUUID } from 'crypto'
import { dirname, join, resolve as resolvePosix } from 'path'

import { useSystemIdentityContext } from '@furystack/core'
import { resolvePath } from '../utils/resolve-path.js'
import { resolveServiceCwd } from '../utils/resolve-service-cwd.js'
import { GitService } from './git-service.js'
import { LogStorageService } from './log-storage-service.js'
import { WebsocketService } from './websocket-service.js'

const MAX_HISTORY_PER_SERVICE = 10_000
const HISTORY_PRUNE_CHECK_INTERVAL = 100

type ManagedProcess = {
  serviceId: string
  process: ChildProcess
  purpose: 'run' | 'install' | 'build'
  processUid: string
}

type TriggerContext = {
  triggeredBy: string
  triggerSource: TriggerSource
}

@Injectable({ lifetime: 'singleton' })
export class ProcessManager {
  private processes = new Map<string, ManagedProcess>()
  private pendingOperations = new Set<string>()
  private elevatedInjector?: Injector
  private historyInsertCount = 0

  private getElevatedInjector(): Injector {
    if (!this.elevatedInjector) {
      this.elevatedInjector = useSystemIdentityContext({ injector: getInjectorReference(this) })
    }
    return this.elevatedInjector
  }

  @Injected((injector) => getLogger(injector).withScope('ProcessManager'))
  declare private logger: ReturnType<ReturnType<typeof getLogger>['withScope']>

  @Injected(LogStorageService)
  declare private logStorage: LogStorageService

  @Injected(WebsocketService)
  declare private ws: WebsocketService

  private logBuffer: Array<{ serviceId: string; processUid: string; stream: 'stdout' | 'stderr'; line: string }> = []
  private flushTimer: ReturnType<typeof setTimeout> | null = null

  private addLogLine(serviceId: string, stream: 'stdout' | 'stderr', line: string) {
    const managed = this.processes.get(serviceId)
    if (!managed) return
    this.logBuffer.push({ serviceId, processUid: managed.processUid, stream, line })
    if (!this.flushTimer) {
      this.flushTimer = setTimeout(() => void this.flushLogBuffer(), 100)
    }
  }

  private async flushLogBuffer(): Promise<void> {
    this.flushTimer = null
    const batch = this.logBuffer.splice(0)
    for (const entry of batch) {
      await this.logStorage.addEntry(entry.serviceId, entry.processUid, entry.stream, entry.line)
    }
  }

  private async updateServiceStatus(
    serviceId: string,
    update: {
      cloneStatus?: CloneStatus
      installStatus?: InstallStatus
      buildStatus?: BuildStatus
      runStatus?: RunStatus
    },
    event: ServiceStateEvent,
    trigger: TriggerContext,
    metadata?: Record<string, unknown>,
    options?: { skipHistory?: boolean; processUid?: string },
  ) {
    try {
      const elevated = this.getElevatedInjector()
      const statusDs = getRepository(elevated).getDataSetFor(ServiceStatus, 'serviceId')

      const statuses = await statusDs.find(elevated, { filter: { serviceId: { $eq: serviceId } }, top: 1 })
      const current = statuses[0]
      if (!current) return

      const now = new Date().toISOString()
      const patchData: Partial<ServiceStatus> = { ...update, updatedAt: now }

      if (update.cloneStatus === 'cloned') patchData.lastClonedAt = now
      if (update.installStatus === 'installed') patchData.lastInstalledAt = now
      if (update.buildStatus === 'built') patchData.lastBuiltAt = now
      if (update.runStatus === 'running') patchData.lastStartedAt = now

      await statusDs.update(elevated, serviceId, patchData)

      if (!options?.skipHistory) {
        const historyDs = getRepository(elevated).getDataSetFor(ServiceStateHistory, 'id')

        const previousState = JSON.stringify({
          cloneStatus: current.cloneStatus,
          installStatus: current.installStatus,
          buildStatus: current.buildStatus,
          runStatus: current.runStatus,
        })

        const newState = JSON.stringify({
          cloneStatus: update.cloneStatus ?? current.cloneStatus,
          installStatus: update.installStatus ?? current.installStatus,
          buildStatus: update.buildStatus ?? current.buildStatus,
          runStatus: update.runStatus ?? current.runStatus,
        })

        await historyDs.add(elevated, {
          serviceId,
          event,
          previousState,
          newState,
          triggeredBy: trigger.triggeredBy,
          triggerSource: trigger.triggerSource,
          metadata: metadata ? JSON.stringify(metadata) : undefined,
          processUid: options?.processUid,
          createdAt: now,
        })

        this.historyInsertCount++
        if (this.historyInsertCount >= HISTORY_PRUNE_CHECK_INTERVAL) {
          this.historyInsertCount = 0
          void this.pruneHistory(serviceId, elevated)
        }
      }

      void this.ws.announce({
        type: 'service-status-changed',
        serviceId,
        cloneStatus: update.cloneStatus ?? current.cloneStatus,
        installStatus: update.installStatus ?? current.installStatus,
        buildStatus: update.buildStatus ?? current.buildStatus,
        runStatus: update.runStatus ?? current.runStatus,
      })
    } catch {
      // May fire after disposal during shutdown — safe to ignore
    }
  }

  private async pruneHistory(serviceId: string, elevated: Injector): Promise<void> {
    try {
      const historyDs = getRepository(elevated).getDataSetFor(ServiceStateHistory, 'id')
      const count = await historyDs.count(elevated, { serviceId: { $eq: serviceId } })
      if (count <= MAX_HISTORY_PER_SERVICE) return

      const excess = count - MAX_HISTORY_PER_SERVICE
      const oldEntries = await historyDs.find(elevated, {
        filter: { serviceId: { $eq: serviceId } },
        order: { id: 'ASC' },
        top: excess,
        select: ['id'],
      })

      if (oldEntries.length > 0) {
        await historyDs.remove(elevated, ...oldEntries.map((e) => e.id))
        await this.logger.verbose({
          message: `Pruned ${oldEntries.length} old history entries for service ${serviceId}`,
        })
      }
    } catch {
      // Pruning is best-effort; safe to ignore on failure
    }
  }

  public async startService(serviceId: string, trigger: TriggerContext): Promise<void> {
    const elevated = this.getElevatedInjector()
    const services = await getRepository(elevated)
      .getDataSetFor(ServiceDefinition, 'id')
      .find(elevated, { filter: { id: { $eq: serviceId } }, top: 1 })
    const svc = services[0]
    if (!svc) throw new Error(`Service not found: ${serviceId}`)

    if (this.processes.has(serviceId) || this.pendingOperations.has(serviceId)) {
      throw new Error(`Service already has a running process: ${serviceId}`)
    }

    this.pendingOperations.add(serviceId)
    try {
      await this.logger.information({ message: `Starting service: ${svc.displayName}` })
      await this.updateServiceStatus(serviceId, { runStatus: 'starting' }, 'run-started', trigger, undefined, {
        skipHistory: true,
      })

      const cwd = await resolveServiceCwd(getInjectorReference(this), svc, elevated)
      const processUid = randomUUID()
      const child = this.spawnCommand(svc.runCommand, cwd)

      const managed: ManagedProcess = {
        serviceId,
        process: child,
        purpose: 'run',
        processUid,
      }
      this.processes.set(serviceId, managed)

      child.stdout?.on('data', (data: Buffer) => {
        const lines = data.toString().split('\n').filter(Boolean)
        lines.forEach((line) => this.addLogLine(serviceId, 'stdout', line))
      })

      child.stderr?.on('data', (data: Buffer) => {
        const lines = data.toString().split('\n').filter(Boolean)
        lines.forEach((line) => this.addLogLine(serviceId, 'stderr', line))
      })

      child.on('error', (err) => {
        void this.logger.error({ message: `Service error: ${svc.displayName}`, data: { error: err } })
        void this.updateServiceStatus(
          serviceId,
          { runStatus: 'error' },
          'run-crashed',
          trigger,
          { error: err.message },
          { processUid },
        )
        this.processes.delete(serviceId)
      })

      child.on('exit', (code) => {
        void this.logger.information({ message: `Service exited: ${svc.displayName} (code ${code})` })
        const newStatus: RunStatus = code === 0 ? 'stopped' : 'error'
        const event: ServiceStateEvent = code === 0 ? 'run-stopped' : 'run-crashed'
        void this.updateServiceStatus(
          serviceId,
          { runStatus: newStatus },
          event,
          trigger,
          { exitCode: code },
          { processUid },
        )
        this.processes.delete(serviceId)
      })

      child.on('spawn', () => {
        void this.updateServiceStatus(serviceId, { runStatus: 'running' }, 'run-started', trigger, undefined, {
          processUid,
        })
      })
    } finally {
      this.pendingOperations.delete(serviceId)
    }
  }

  public async stopService(serviceId: string, trigger: TriggerContext): Promise<void> {
    const managed = this.processes.get(serviceId)
    if (!managed || managed.purpose !== 'run') {
      throw new Error(`No running process for service: ${serviceId}`)
    }

    await this.logger.information({ message: `Stopping service: ${serviceId}` })
    await this.updateServiceStatus(serviceId, { runStatus: 'stopping' }, 'run-stopped', trigger, undefined, {
      skipHistory: true,
    })

    this.killProcessGroup(managed.process, 'SIGTERM')

    await new Promise<void>((resolve) => {
      const timeout = setTimeout(() => {
        this.killProcessGroup(managed.process, 'SIGKILL')
        resolve()
      }, 10000)

      managed.process.on('exit', () => {
        clearTimeout(timeout)
        resolve()
      })
    })
  }

  public async restartService(serviceId: string, trigger: TriggerContext): Promise<void> {
    if (this.processes.has(serviceId)) {
      await this.stopService(serviceId, trigger)
    }
    await this.startService(serviceId, trigger)
  }

  public async installService(serviceId: string, trigger: TriggerContext): Promise<void> {
    const elevated = this.getElevatedInjector()
    const services = await getRepository(elevated)
      .getDataSetFor(ServiceDefinition, 'id')
      .find(elevated, { filter: { id: { $eq: serviceId } }, top: 1 })
    const svc = services[0]
    if (!svc?.installCommand) throw new Error(`No install command for service: ${serviceId}`)

    const cwd = await resolveServiceCwd(getInjectorReference(this), svc, elevated)
    await this.runOneShot(serviceId, svc.installCommand, cwd, 'install', trigger)
  }

  public async buildService(serviceId: string, trigger: TriggerContext): Promise<void> {
    const elevated = this.getElevatedInjector()
    const services = await getRepository(elevated)
      .getDataSetFor(ServiceDefinition, 'id')
      .find(elevated, { filter: { id: { $eq: serviceId } }, top: 1 })
    const svc = services[0]
    if (!svc?.buildCommand) throw new Error(`No build command for service: ${serviceId}`)

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

    const services = await repository
      .getDataSetFor(ServiceDefinition, 'id')
      .find(elevated, { filter: { id: { $eq: serviceId } }, top: 1 })
    const svc = services[0]
    if (!svc) throw new Error(`Service not found: ${serviceId}`)

    const configs = await repository
      .getDataSetFor(StackConfig, 'stackName')
      .find(elevated, { filter: { stackName: { $eq: svc.stackName } }, top: 1 })
    const stackConfig = configs[0]
    if (!stackConfig) throw new Error(`Stack config not found: ${svc.stackName}`)

    let repo: GitHubRepository | null = null
    if (svc.repositoryId) {
      const repos = await repository
        .getDataSetFor(GitHubRepository, 'id')
        .find(elevated, { filter: { id: { $eq: svc.repositoryId } }, top: 1 })
      repo = repos[0] ?? null
    }
    if (!repo?.url) {
      throw new Error(`No repository linked. Link a GitHub repository to enable clone/pull.`)
    }

    const cwd = resolvePath(getServiceCwd(stackConfig, svc, repo))
    const stackRoot = resolvePosix(resolvePath(stackConfig.mainDirectory))
    if (!cwd.startsWith(stackRoot)) {
      throw new Error(`Resolved path "${cwd}" is outside the stack directory "${stackRoot}"`)
    }

    await this.updateServiceStatus(serviceId, { cloneStatus: 'cloning' }, 'clone-started', trigger)

    try {
      const git = getInjectorReference(this).getInstance(GitService)
      const isGitRepo = existsSync(cwd) && existsSync(join(cwd, '.git'))

      if (!existsSync(cwd)) {
        await this.logger.information({ message: `Cloning ${repo.url} into ${cwd}` })
        mkdirSync(dirname(cwd), { recursive: true })
        await git.clone(repo.url, cwd)
        await this.updateServiceStatus(serviceId, { cloneStatus: 'cloned' }, 'clone-completed', trigger)
        return { cloned: true, pulled: false, updated: true }
      } else if (isGitRepo) {
        await this.logger.information({ message: `Pulling in ${cwd}` })
        const { updated } = await git.pull(cwd)
        await this.updateServiceStatus(serviceId, { cloneStatus: 'cloned' }, 'clone-completed', trigger)
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
        await this.updateServiceStatus(serviceId, { cloneStatus: 'cloned' }, 'clone-completed', trigger)
        return { cloned: true, pulled: false, updated: true }
      }
    } catch (error) {
      await this.updateServiceStatus(serviceId, { cloneStatus: 'failed' }, 'clone-failed', trigger, {
        error: error instanceof Error ? error.message : 'Unknown clone/pull error',
      })
      throw error
    }
  }

  /**
   * Runs the full setup pipeline for a service: clone -> install -> build.
   * Skips steps that don't apply (e.g. no repo, no installCommand).
   * Stops on first failure.
   */
  public async setupService(serviceId: string, trigger: TriggerContext): Promise<void> {
    const elevated = this.getElevatedInjector()
    const services = await getRepository(elevated)
      .getDataSetFor(ServiceDefinition, 'id')
      .find(elevated, { filter: { id: { $eq: serviceId } }, top: 1 })
    const svc = services[0]
    if (!svc) throw new Error(`Service not found: ${serviceId}`)

    await this.updateServiceStatus(serviceId, {}, 'setup-started', trigger)

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

      await this.updateServiceStatus(serviceId, {}, 'setup-completed', trigger)
    } catch (error) {
      await this.updateServiceStatus(serviceId, {}, 'setup-failed', trigger, {
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
    const services = await getRepository(elevated)
      .getDataSetFor(ServiceDefinition, 'id')
      .find(elevated, { filter: { id: { $eq: serviceId } }, top: 1 })
    const svc = services[0]
    if (!svc) throw new Error(`Service not found: ${serviceId}`)

    const statuses = await getRepository(elevated)
      .getDataSetFor(ServiceStatus, 'serviceId')
      .find(elevated, { filter: { serviceId: { $eq: serviceId } }, top: 1 })
    const currentStatus = statuses[0]

    await this.updateServiceStatus(serviceId, {}, 'update-started', trigger)

    try {
      if (!svc.repositoryId) {
        throw new Error('No repository linked to this service')
      }

      const { updated } = await this.cloneOrPullService(serviceId, trigger)

      if (!updated) {
        await this.updateServiceStatus(serviceId, {}, 'update-completed', trigger, {
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

      await this.updateServiceStatus(serviceId, {}, 'update-completed', trigger)
    } catch (error) {
      await this.updateServiceStatus(serviceId, {}, 'update-failed', trigger, {
        error: error instanceof Error ? error.message : 'Update failed',
      })
      throw error
    }
  }

  /**
   * Sets up multiple services respecting prerequisite dependencies.
   * Uses topological sort to determine execution order. Services in the
   * same level run in parallel. Circular dependencies are resolved by
   * merging cycle members into the same level.
   */
  public async setupServices(serviceIds: string[], trigger: TriggerContext): Promise<void> {
    const elevated = this.getElevatedInjector()
    const allServices = await getRepository(elevated).getDataSetFor(ServiceDefinition, 'id').find(elevated, {})

    const serviceMap = new Map(allServices.map((s) => [s.id, s]))
    const targetSet = new Set(serviceIds)

    const levels = this.computeExecutionLevels(serviceIds, serviceMap, targetSet)

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

  /**
   * Computes execution levels via topological sort with cycle resolution.
   * Returns an array of arrays: each inner array is a set of service IDs
   * that can run in parallel. Levels are executed sequentially.
   */
  private computeExecutionLevels(
    serviceIds: string[],
    serviceMap: Map<string, ServiceDefinition>,
    targetSet: Set<string>,
  ): string[][] {
    const inDegree = new Map<string, number>()
    const dependents = new Map<string, string[]>()

    for (const id of serviceIds) {
      inDegree.set(id, 0)
      dependents.set(id, [])
    }

    for (const id of serviceIds) {
      const svc = serviceMap.get(id)
      if (!svc) continue
      for (const prereq of svc.prerequisiteServiceIds) {
        if (targetSet.has(prereq)) {
          inDegree.set(id, (inDegree.get(id) ?? 0) + 1)
          dependents.get(prereq)?.push(id)
        }
      }
    }

    const levels: string[][] = []
    const remaining = new Set(serviceIds)

    while (remaining.size > 0) {
      const level = [...remaining].filter((id) => (inDegree.get(id) ?? 0) === 0)

      if (level.length === 0) {
        // Cycle detected: all remaining nodes have non-zero in-degree.
        // Break the deadlock by running them all in parallel.
        levels.push([...remaining])
        break
      }

      levels.push(level)

      for (const id of level) {
        remaining.delete(id)
        for (const dep of dependents.get(id) ?? []) {
          inDegree.set(dep, (inDegree.get(dep) ?? 0) - 1)
        }
      }
    }

    return levels
  }

  private async runOneShot(
    serviceId: string,
    command: string,
    cwd: string,
    purpose: 'install' | 'build',
    trigger: TriggerContext,
  ): Promise<void> {
    if (this.processes.has(serviceId) || this.pendingOperations.has(serviceId)) {
      const existing = this.processes.get(serviceId)
      throw new Error(
        `Service ${serviceId} already has a ${existing?.purpose ?? purpose} process running. Stop it before starting a ${purpose}.`,
      )
    }

    this.pendingOperations.add(serviceId)

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
    await this.updateServiceStatus(serviceId, progressStatus, progressEvent, trigger, undefined, { processUid })

    const child = this.spawnCommand(command, cwd)

    const managed: ManagedProcess = {
      serviceId,
      process: child,
      purpose,
      processUid,
    }
    this.processes.set(serviceId, managed)
    this.pendingOperations.delete(serviceId)

    child.stdout?.on('data', (data: Buffer) => {
      data
        .toString()
        .split('\n')
        .filter(Boolean)
        .forEach((line) => this.addLogLine(serviceId, 'stdout', line))
    })

    child.stderr?.on('data', (data: Buffer) => {
      data
        .toString()
        .split('\n')
        .filter(Boolean)
        .forEach((line) => this.addLogLine(serviceId, 'stderr', line))
    })

    return new Promise((resolve, reject) => {
      child.on('error', (err) => {
        void this.updateServiceStatus(
          serviceId,
          failedStatus,
          failedEvent,
          trigger,
          { error: err.message },
          { processUid },
        )
        this.processes.delete(serviceId)
        reject(err)
      })

      child.on('exit', (code) => {
        this.processes.delete(serviceId)
        if (code === 0) {
          void this.updateServiceStatus(serviceId, doneStatus, doneEvent, trigger, undefined, { processUid })
          resolve()
        } else {
          void this.updateServiceStatus(
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
   * Kills a managed process and all its children by targeting the process group.
   * Falls back to killing just the shell process if the group kill fails
   * (e.g. the process already exited).
   */
  private killProcessGroup(child: ChildProcess, signal: NodeJS.Signals): boolean {
    if (child.pid == null) return false
    try {
      process.kill(-child.pid, signal)
      return true
    } catch {
      try {
        return child.kill(signal)
      } catch {
        return false
      }
    }
  }

  private spawnCommand(command: string, cwd: string): ChildProcess {
    const isWindows = process.platform === 'win32'
    const shell = isWindows ? 'cmd.exe' : '/bin/sh'
    const shellFlag = isWindows ? '/c' : '-c'

    return spawn(shell, [shellFlag, command], {
      cwd,
      stdio: ['ignore', 'pipe', 'pipe'],
      env: { ...process.env },
      detached: true,
    })
  }

  /**
   * Resets any transient service states left over from a previous backend run.
   * Should be called once during startup, after data stores are ready.
   */
  public async reconcileStaleStates(): Promise<void> {
    const elevated = this.getElevatedInjector()
    const statusDs = getRepository(elevated).getDataSetFor(ServiceStatus, 'serviceId')
    const allStatuses = await statusDs.find(elevated, {})

    const reconcileTrigger: TriggerContext = { triggeredBy: 'system', triggerSource: 'system' }
    const staleMetadata = {
      reason: 'Stale state detected on startup. Service may have been terminated outside the application.',
    }

    for (const status of allStatuses) {
      const update: Partial<ServiceStatus> = {}
      let hasStaleState = false

      if (status.runStatus === 'running' || status.runStatus === 'starting' || status.runStatus === 'stopping') {
        update.runStatus = 'stopped'
        hasStaleState = true
      }

      if (status.installStatus === 'installing') {
        update.installStatus = 'not-installed'
        hasStaleState = true
      }

      if (status.buildStatus === 'building') {
        update.buildStatus = 'not-built'
        hasStaleState = true
      }

      if (status.cloneStatus === 'cloning') {
        update.cloneStatus = 'not-cloned'
        hasStaleState = true
      }

      if (hasStaleState) {
        await this.logger.warning({
          message: `Reconciling stale state for service ${status.serviceId}: ${JSON.stringify(update)}`,
        })
        await this.updateServiceStatus(status.serviceId, update, 'state-reconciled', reconcileTrigger, staleMetadata)
      }
    }
  }

  public async [Symbol.asyncDispose]() {
    if (this.flushTimer) {
      clearTimeout(this.flushTimer)
      this.flushTimer = null
    }
    await this.flushLogBuffer()

    await this.logger.information({ message: 'Disposing ProcessManager, killing all child processes...' })

    const entries = [...this.processes.entries()]

    const shutdownTrigger: TriggerContext = { triggeredBy: 'system', triggerSource: 'system' }
    for (const [serviceId] of entries) {
      await this.updateServiceStatus(serviceId, { runStatus: 'stopped' }, 'run-stopped', shutdownTrigger, {
        reason: 'backend-shutdown',
      })
    }

    if (entries.length > 0) {
      for (const [serviceId, managed] of entries) {
        this.killProcessGroup(managed.process, 'SIGTERM')
        void this.logger.information({ message: `Sent SIGTERM to service: ${serviceId}` })
      }

      await Promise.all(
        entries.map(
          ([serviceId, managed]) =>
            new Promise<void>((resolve) => {
              const timeout = setTimeout(() => {
                if (!managed.process.killed) {
                  this.killProcessGroup(managed.process, 'SIGKILL')
                  void this.logger.warning({ message: `Sent SIGKILL to service: ${serviceId}` })
                }
                resolve()
              }, 5000)

              managed.process.on('exit', () => {
                clearTimeout(timeout)
                resolve()
              })
            }),
        ),
      )

      this.processes.clear()
    }

    try {
      await this.elevatedInjector?.[Symbol.asyncDispose]()
    } catch {
      // May already be disposed by the parent injector
    }
  }
}
