import {
  ServiceConfigDataSet,
  ServiceDefinitionDataSet,
  ServiceGitStatusDataSet,
  ServiceStatusDataSet,
} from '../app-models/data-store/tokens.js'
import { getDataSetFor } from '@furystack/repository'
import { type Injector, defineService, type Token } from '@furystack/inject'
import { getLogger } from '@furystack/logging'

import { useSystemIdentityContext } from '@furystack/core'
import { resolveServiceCwd } from '../utils/resolve-service-cwd.js'
import { GitService } from './git-service.js'
const FETCH_CHECK_INTERVAL_MS = 5 * 60 * 1000

type WatchEntry = {
  serviceId: string
  timer: ReturnType<typeof setInterval>
  lastBranches: Set<string>
  isFetching: boolean
}

/** Periodically fetches remote changes for watched services and optionally auto-restarts on new commits */
class GitWatcherImpl {
  private logger!: ReturnType<ReturnType<typeof getLogger>['withScope']>

  constructor(
    private readonly git: GitService,
    public readonly injector: Injector,
  ) {
    this.logger = getLogger(injector).withScope('GitWatcher')
  }

  private watchers = new Map<string, WatchEntry>()
  private elevatedInjector?: Injector

  private getElevatedInjector(): Injector {
    if (!this.elevatedInjector) {
      this.elevatedInjector = useSystemIdentityContext({ injector: this.injector })
    }
    return this.elevatedInjector
  }

  public async startWatching(serviceId: string): Promise<void> {
    if (this.watchers.has(serviceId)) return

    const elevated = this.getElevatedInjector()
    const svcDefDs = getDataSetFor(elevated, ServiceDefinitionDataSet)

    const defs = await svcDefDs.find(elevated, { filter: { id: { $eq: serviceId } }, top: 1 })
    const svc = defs[0]
    if (!svc?.repositoryId) return

    const cwd = await resolveServiceCwd(this.injector, svc, elevated)
    const { remote } = await this.git.getBranches(cwd).catch(() => ({ remote: [] as string[] }))

    const entry: WatchEntry = {
      serviceId,
      lastBranches: new Set(remote),
      isFetching: false,
      timer: setInterval(() => void this.fetchAndCheck(serviceId), FETCH_CHECK_INTERVAL_MS),
    }

    this.watchers.set(serviceId, entry)
    await this.logger.information({
      message: `Started watching service ${svc.displayName} (every ${FETCH_CHECK_INTERVAL_MS / 60000}min)`,
    })
    void this.fetchAndCheck(serviceId)
  }

  public stopWatching(serviceId: string): void {
    const entry = this.watchers.get(serviceId)
    if (entry) {
      clearInterval(entry.timer)
      this.watchers.delete(serviceId)
    }
  }

  private async fetchAndCheck(serviceId: string): Promise<void> {
    const entry = this.watchers.get(serviceId)
    if (!entry || entry.isFetching) return

    entry.isFetching = true
    const elevated = this.getElevatedInjector()
    const svcDefDs = getDataSetFor(elevated, ServiceDefinitionDataSet)
    const svcConfigDs = getDataSetFor(elevated, ServiceConfigDataSet)
    const statusDs = getDataSetFor(elevated, ServiceStatusDataSet)
    const gitStatusDs = getDataSetFor(elevated, ServiceGitStatusDataSet)

    const defs = await svcDefDs.find(elevated, { filter: { id: { $eq: serviceId } }, top: 1 })
    const svc = defs[0]
    if (!svc?.repositoryId) {
      entry.isFetching = false
      return
    }

    // Bail out if the watcher was stopped while we were awaiting above.
    // Without this guard the rest of the method may dereference `@Injected` getters
    // on an already-disposed injector and produce an unhandled rejection.
    if (!this.watchers.has(serviceId)) {
      entry.isFetching = false
      return
    }

    const configs = await svcConfigDs.find(elevated, { filter: { serviceId: { $eq: serviceId } }, top: 1 })
    const config = configs[0]

    const cwd = await resolveServiceCwd(this.injector, svc, elevated)

    try {
      await this.git.fetch(cwd)
      await statusDs.update(elevated, serviceId, { lastFetchedAt: new Date().toISOString() })

      const currentBranch = await this.git.getCurrentBranch(cwd).catch(() => undefined)
      const worktreeStatus = await this.git.getWorktreeStatus(cwd).catch(() => 'unknown' as const)
      if (currentBranch) {
        const upstreamPresent = await this.git.hasRemoteBranch(cwd, currentBranch)
        const commitsBehind = upstreamPresent ? await this.git.getCommitsBehind(cwd, currentBranch) : 0
        const patch = {
          currentBranch,
          commitsBehind,
          upstreamStatus: upstreamPresent ? ('present' as const) : ('gone' as const),
          worktreeStatus,
        }
        const existing = await gitStatusDs.find(elevated, { filter: { serviceId: { $eq: serviceId } }, top: 1 })
        if (existing.length > 0) {
          await gitStatusDs.update(elevated, serviceId, patch)
        } else {
          await gitStatusDs.add(elevated, { serviceId, ...patch })
        }
      } else {
        const existing = await gitStatusDs.find(elevated, { filter: { serviceId: { $eq: serviceId } }, top: 1 })
        if (existing.length > 0) {
          await gitStatusDs.update(elevated, serviceId, { worktreeStatus })
        }
      }

      const { remote } = await this.git.getBranches(cwd)
      const newBranches = remote.filter((b) => !entry.lastBranches.has(b))

      if (newBranches.length > 0) {
        await this.logger.information({
          message: `New branches detected for ${svc.displayName}: ${newBranches.join(', ')}`,
        })
        entry.lastBranches = new Set(remote)
      }

      const upstreamForAutoPull = currentBranch ? await this.git.hasRemoteBranch(cwd, currentBranch) : false
      if (config?.autoRestartOnFetch && upstreamForAutoPull) {
        const autoRestartTrigger = { triggeredBy: 'system', triggerSource: 'auto-restart' as const }
        const { updated } = await this.git.pull(cwd)
        if (updated) {
          await this.logger.information({ message: `Changes pulled, restarting ${svc.displayName}` })
          const { ProcessManager } = await import('./process-manager.js')
          const pm = this.injector.get(ProcessManager)
          if (svc.installCommand) await pm.installService(serviceId, autoRestartTrigger)
          if (svc.buildCommand) await pm.buildService(serviceId, autoRestartTrigger)
          await pm.restartService(serviceId, autoRestartTrigger)
        }
      }
    } catch (error) {
      // Guard against the injector being disposed mid-flight (common in tests
      // where the watcher is stopped right after start). Touching `this.logger`
      // re-resolves it via DI; on a disposed injector that throws.
      if (this.watchers.has(serviceId)) {
        try {
          await this.logger.warning({
            message: `Git fetch failed for ${svc.displayName}`,
            data: { error },
          })
        } catch {
          // Injector torn down between watcher entry check and logger access; nothing to log to.
        }
      }
    } finally {
      entry.isFetching = false
    }
  }

  public async [Symbol.asyncDispose]() {
    for (const [, entry] of this.watchers) {
      clearInterval(entry.timer)
    }
    this.watchers.clear()
    try {
      await this.elevatedInjector?.[Symbol.asyncDispose]()
    } catch {
      // May already be disposed by the parent injector
    }
  }
}

export type GitWatcher = GitWatcherImpl

export const GitWatcher: Token<GitWatcher, 'singleton'> = defineService({
  name: 'app/GitWatcher',
  lifetime: 'singleton',
  factory: ({ inject, injector }) => new GitWatcherImpl(inject(GitService), injector),
})
