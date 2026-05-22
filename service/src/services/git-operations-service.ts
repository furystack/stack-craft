import { ServiceConfigDataSet, ServiceGitStatusDataSet } from '../app-models/data-store/tokens.js'
import { getDataSetFor } from '@furystack/repository'
import { useSystemIdentityContext } from '@furystack/core'
import { type Injector, defineService, type Token } from '@furystack/inject'
import { getLogger } from '@furystack/logging'
import type { ServiceDefinition, ServiceGitStatus } from 'common'
import { GitHubRepository, StackConfig, getServiceCwd } from 'common'
import { existsSync, mkdirSync, readdirSync, renameSync } from 'fs'
import { dirname, join, resolve as resolvePosix, sep } from 'path'

import { applyServiceFiles, mergeServiceFiles } from '../utils/apply-service-files.js'
import { CryptoService } from '../utils/crypto-service.js'
import { NotFoundError, ValidationError } from '../utils/domain-error.js'
import { decryptLocalFiles } from '../utils/env-encryption-helpers.js'
import { getServiceOrThrow } from '../utils/get-service-or-throw.js'
import { resolvePath } from '../utils/resolve-path.js'
import { GitHeadWatcher } from './git-head-watcher.js'
import { GitService } from './git-service.js'
import { GitWatcher } from './git-watcher.js'
import type { TriggerContext } from './trigger-context.js'
import { ServiceEnvResolver } from './service-env-resolver.js'
import { ServiceStatusManager } from './service-status-manager.js'
import { legacyRepository as getRepository } from '../utils/legacy-repository.js'

class GitOperationsServiceImpl {
  private logger!: ReturnType<ReturnType<typeof getLogger>['withScope']>

  constructor(
    private readonly statusManager: ServiceStatusManager,
    private readonly envResolver: ServiceEnvResolver,
    private readonly gitHeadWatcher: GitHeadWatcher,
    private readonly gitWatcher: GitWatcher,
    public readonly injector: Injector,
  ) {
    this.logger = getLogger(injector).withScope('GitOperationsService')
  }

  private elevatedInjector?: Injector

  private getElevatedInjector(): Injector {
    if (!this.elevatedInjector) {
      this.elevatedInjector = useSystemIdentityContext({ injector: this.injector })
    }
    return this.elevatedInjector
  }

  public async cloneOrPullService(
    serviceId: string,
    trigger: TriggerContext,
  ): Promise<{ cloned: boolean; pulled: boolean; updated: boolean; upstreamGone?: boolean }> {
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

    const git = this.injector.get(GitService)
    const isGitRepo = existsSync(cwd) && existsSync(join(cwd, '.git'))

    await this.statusManager.updateServiceStatus(serviceId, { cloneStatus: 'cloning' }, 'clone-started', trigger)

    try {
      if (!existsSync(cwd)) {
        await this.logger.information({ message: `Cloning ${repo.url} into ${cwd}` })
        mkdirSync(dirname(cwd), { recursive: true })
        await git.clone(repo.url, cwd)
        await this.statusManager.updateServiceStatus(serviceId, { cloneStatus: 'cloned' }, 'clone-completed', trigger)
        await this.upsertGitStatusPatch(serviceId, { lastPullError: undefined, upstreamStatus: 'present' })
        await this.gitHeadWatcher.watch(serviceId, cwd)
        void this.gitWatcher.startWatching(serviceId)
        await this.applySharedFiles(svc, cwd)
        return { cloned: true, pulled: false, updated: true }
      } else if (isGitRepo) {
        return await this.pullExistingRepo(serviceId, cwd, svc, trigger, git)
      } else {
        const dirContents = readdirSync(cwd)
        const backupPath = `${cwd}.backup-${Date.now()}`
        if (dirContents.length > 0) {
          await this.logger.warning({
            message: `Directory "${cwd}" exists with ${dirContents.length} entries but is not a git repo. Moving to "${backupPath}" and re-cloning. The backup directory is left in place and must be cleaned up manually.`,
          })
        } else {
          await this.logger.warning({
            message: `Empty directory "${cwd}" moved to "${backupPath}" before re-cloning. The backup directory is left in place and must be cleaned up manually.`,
          })
        }
        renameSync(cwd, backupPath)
        mkdirSync(dirname(cwd), { recursive: true })
        await git.clone(repo.url, cwd)
        await this.statusManager.updateServiceStatus(serviceId, { cloneStatus: 'cloned' }, 'clone-completed', trigger)
        await this.upsertGitStatusPatch(serviceId, { lastPullError: undefined, upstreamStatus: 'present' })
        await this.gitHeadWatcher.watch(serviceId, cwd)
        void this.gitWatcher.startWatching(serviceId)
        await this.applySharedFiles(svc, cwd)
        return { cloned: true, pulled: false, updated: true }
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown clone/pull error'
      // Only regress cloneStatus to 'failed' when there is no cloned repo on disk.
      // For pull failures on an already-cloned repo, preserve 'cloned' and surface the error
      // via ServiceGitStatus.lastPullError so the UI keeps the branch selector usable.
      if (isGitRepo) {
        await this.upsertGitStatusPatch(serviceId, { lastPullError: message })
        await this.statusManager.updateServiceStatus(serviceId, { cloneStatus: 'cloned' }, 'clone-failed', trigger, {
          error: message,
        })
      } else {
        await this.statusManager.updateServiceStatus(serviceId, { cloneStatus: 'failed' }, 'clone-failed', trigger, {
          error: message,
        })
      }
      throw error
    }
  }

  private async pullExistingRepo(
    serviceId: string,
    cwd: string,
    svc: ServiceDefinition,
    trigger: TriggerContext,
    git: GitService,
  ): Promise<{ cloned: false; pulled: boolean; updated: boolean; upstreamGone?: boolean }> {
    // Fetch with prune first so deleted remote branches disappear from refs/remotes/origin.
    await git.fetch(cwd)

    const currentBranch = await git.getCurrentBranch(cwd).catch(() => undefined)
    if (currentBranch) {
      const upstreamPresent = await git.hasRemoteBranch(cwd, currentBranch)
      if (!upstreamPresent) {
        await this.upsertGitStatusPatch(serviceId, {
          upstreamStatus: 'gone',
          lastPullError: undefined,
        })
        await this.statusManager.updateServiceStatus(serviceId, { cloneStatus: 'cloned' }, 'upstream-gone', trigger, {
          branch: currentBranch,
        })
        await this.gitHeadWatcher.watch(serviceId, cwd)
        void this.gitWatcher.startWatching(serviceId)
        return { cloned: false, pulled: false, updated: false, upstreamGone: true }
      }
      await this.upsertGitStatusPatch(serviceId, { upstreamStatus: 'present' })
    }

    await this.logger.information({ message: `Pulling in ${cwd}` })
    const { updated } = await git.pull(cwd)
    await this.statusManager.updateServiceStatus(serviceId, { cloneStatus: 'cloned' }, 'clone-completed', trigger)
    // After a successful pull the local branch is in sync with origin, so commitsBehind is 0.
    // The chokidar-based GitHeadWatcher is re-attached after this and would miss the writes
    // that just happened (ignoreInitial: true), and GitWatcher only re-checks every 5 minutes,
    // so the badge would otherwise stay stale until the next periodic fetch.
    await this.upsertGitStatusPatch(serviceId, { lastPullError: undefined, commitsBehind: 0 })
    await this.gitHeadWatcher.watch(serviceId, cwd)
    void this.gitWatcher.startWatching(serviceId)
    await this.applySharedFiles(svc, cwd)
    return { cloned: false, pulled: true, updated }
  }

  private async upsertGitStatusPatch(serviceId: string, patch: Partial<ServiceGitStatus>): Promise<void> {
    try {
      const elevated = this.getElevatedInjector()
      const ds = getDataSetFor(elevated, ServiceGitStatusDataSet)
      const existing = await ds.find(elevated, { filter: { serviceId: { $eq: serviceId } }, top: 1 })
      if (existing.length > 0) {
        await ds.update(elevated, serviceId, patch)
      } else {
        await ds.add(elevated, { serviceId, ...patch })
      }
    } catch (error) {
      void this.logger.verbose({
        message: `Failed to patch git status for ${serviceId}: ${(error as Error).message}`,
      })
    }
  }

  private async applySharedFiles(svc: ServiceDefinition, cwd: string): Promise<void> {
    const elevated = this.getElevatedInjector()
    const crypto = elevated.get(CryptoService)

    const svcConfigs = await getDataSetFor(elevated, ServiceConfigDataSet).find(elevated, {
      filter: { serviceId: { $eq: svc.id } },
      top: 1,
    })
    const localFiles = decryptLocalFiles(crypto, svcConfigs[0]?.localFiles ?? [])
    const sharedFiles = svc.files ?? []

    const merged = mergeServiceFiles(sharedFiles, localFiles)
    if (merged.length === 0) return

    try {
      const variables = await this.envResolver.resolveServiceEnvVars(svc.id)
      const applied = applyServiceFiles(cwd, merged, undefined, variables)
      void this.logger.information({
        message: `Applied ${applied.length} file(s) for ${svc.displayName}: ${applied.map((a) => a.relativePath).join(', ')}`,
      })
      const filesWithUnresolved = applied.filter((a) => a.unresolved.length > 0)
      if (filesWithUnresolved.length > 0) {
        const summary = filesWithUnresolved.map((a) => `${a.relativePath}: ${a.unresolved.join(', ')}`).join(' | ')
        void this.logger.warning({
          message: `Unresolved template placeholders for ${svc.displayName} — ${summary}. Add the missing variables to the stack environment to interpolate them on next apply.`,
        })
      }
    } catch (error) {
      void this.logger.warning({
        message: `Failed to apply files for ${svc.displayName}: ${(error as Error).message}`,
      })
    }
  }

  public async [Symbol.asyncDispose]() {
    try {
      await this.elevatedInjector?.[Symbol.asyncDispose]()
    } catch {
      // May already be disposed by the parent injector
    }
  }
}

export type GitOperationsService = GitOperationsServiceImpl

export const GitOperationsService: Token<GitOperationsService, 'singleton'> = defineService({
  name: 'app/GitOperationsService',
  lifetime: 'singleton',
  factory: ({ inject, injector }) =>
    new GitOperationsServiceImpl(
      inject(ServiceStatusManager),
      inject(ServiceEnvResolver),
      inject(GitHeadWatcher),
      inject(GitWatcher),
      injector,
    ),
})
