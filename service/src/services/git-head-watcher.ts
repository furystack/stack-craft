import { useSystemIdentityContext } from '@furystack/core'
import { defineService, type Injector, type Token } from '@furystack/inject'
import { getDataSetFor } from '@furystack/repository'
import { getLogger } from '@furystack/logging'
import chokidar, { type FSWatcher } from 'chokidar'
import { EventEmitter } from 'events'
import { existsSync } from 'fs'
import { join } from 'path'

import { ServiceGitStatusDataSet } from '../app-models/data-store/tokens.js'
import { GitService } from './git-service.js'

type WatchedEntry = {
  cwd: string
  watcher: FSWatcher
  debounceTimer?: ReturnType<typeof setTimeout>
  lastBranch?: string
  lastBranchSha?: string
}

const DEBOUNCE_MS = 200

/**
 * Payload emitted on `externalChange`. Distinguishes between branch switches
 * (HEAD ref changed) and pull-detected events (branch ref advanced).
 */
export type GitHeadChangeEvent = {
  serviceId: string
  previousBranch?: string
  currentBranch?: string
  previousSha?: string
  currentSha?: string
  kind: 'branch-switched' | 'pull-detected' | 'unknown'
}

/**
 * Watches `.git/HEAD` and `.git/refs/heads/` of cloned services to detect
 * branch switches and external pulls performed outside the application.
 */
class GitHeadWatcherImpl extends EventEmitter<{ externalChange: [GitHeadChangeEvent] }> {
  private watchers = new Map<string, WatchedEntry>()
  private elevatedInjector?: Injector
  private logger: ReturnType<ReturnType<typeof getLogger>['withScope']>

  constructor(
    private readonly injector: Injector,
    private readonly git: GitService,
  ) {
    super()
    this.logger = getLogger(injector).withScope('GitHeadWatcher')
  }

  private getElevatedInjector(): Injector {
    if (!this.elevatedInjector) {
      this.elevatedInjector = useSystemIdentityContext({ injector: this.injector })
    }
    return this.elevatedInjector
  }

  public async watch(serviceId: string, cwd: string): Promise<void> {
    this.unwatch(serviceId)

    const gitDir = join(cwd, '.git')
    if (!existsSync(join(gitDir, 'HEAD'))) return

    const branch = await this.readBranch(serviceId, cwd)
    const branchSha = branch ? await this.git.revParse(cwd, `refs/heads/${branch}`) : undefined
    const commitsBehind = branch ? await this.git.getCommitsBehind(cwd, branch).catch(() => undefined) : undefined
    await this.upsertGitStatus(serviceId, branch, commitsBehind)

    try {
      // `packed-refs` is included so changes made after `git gc` (which packs loose refs into
      // `.git/packed-refs`) still trigger branch/commit detection.
      const watcher = chokidar.watch(
        [join(gitDir, 'HEAD'), join(gitDir, 'refs', 'heads'), join(gitDir, 'packed-refs')],
        {
          ignoreInitial: true,
          persistent: true,
          awaitWriteFinish: { stabilityThreshold: 50, pollInterval: 30 },
          depth: 10,
        },
      )

      const entry: WatchedEntry = { cwd, watcher, lastBranch: branch, lastBranchSha: branchSha }
      this.watchers.set(serviceId, entry)

      const schedule = () => {
        const current = this.watchers.get(serviceId)
        if (!current) return
        if (current.debounceTimer) clearTimeout(current.debounceTimer)
        current.debounceTimer = setTimeout(() => {
          void this.onHeadChanged(serviceId, cwd)
        }, DEBOUNCE_MS)
      }

      watcher.on('change', schedule)
      watcher.on('add', schedule)
      watcher.on('unlink', schedule)
      watcher.on('error', (error) => {
        void this.logger.verbose({
          message: `GitHeadWatcher error for ${serviceId}: ${(error as Error).message}`,
        })
      })
    } catch (error) {
      void this.logger.verbose({
        message: `Could not watch .git for service ${serviceId}: ${(error as Error).message}`,
      })
    }
  }

  public unwatch(serviceId: string): void {
    const entry = this.watchers.get(serviceId)
    if (entry) {
      if (entry.debounceTimer) clearTimeout(entry.debounceTimer)
      void entry.watcher.close()
      this.watchers.delete(serviceId)
    }
  }

  private async onHeadChanged(serviceId: string, cwd: string): Promise<void> {
    const entry = this.watchers.get(serviceId)
    if (!entry) return

    const previousBranch = entry.lastBranch
    const previousSha = entry.lastBranchSha

    const branch = await this.readBranch(serviceId, cwd)
    const branchSha = branch ? await this.git.revParse(cwd, `refs/heads/${branch}`) : undefined
    const commitsBehind = branch ? await this.git.getCommitsBehind(cwd, branch).catch(() => 0) : undefined
    await this.upsertGitStatus(serviceId, branch, commitsBehind)

    entry.lastBranch = branch
    entry.lastBranchSha = branchSha

    let kind: GitHeadChangeEvent['kind'] = 'unknown'
    if (previousBranch !== branch) kind = 'branch-switched'
    else if (previousSha && branchSha && previousSha !== branchSha) kind = 'pull-detected'

    if (kind !== 'unknown') {
      this.emit('externalChange', {
        serviceId,
        previousBranch,
        currentBranch: branch,
        previousSha,
        currentSha: branchSha,
        kind,
      })
    }
  }

  private async readBranch(serviceId: string, cwd: string): Promise<string | undefined> {
    try {
      const branch = await this.git.getCurrentBranch(cwd)
      return branch || undefined
    } catch {
      void this.logger.verbose({ message: `Could not read branch for service ${serviceId}` })
      return undefined
    }
  }

  private async upsertGitStatus(
    serviceId: string,
    currentBranch: string | undefined,
    commitsBehind?: number,
  ): Promise<void> {
    try {
      const elevated = this.getElevatedInjector()
      const ds = getDataSetFor(elevated, ServiceGitStatusDataSet)
      const existing = await ds.find(elevated, { filter: { serviceId: { $eq: serviceId } }, top: 1 })

      if (existing.length > 0) {
        await ds.update(elevated, serviceId, { currentBranch, commitsBehind })
      } else {
        await ds.add(elevated, { serviceId, currentBranch, commitsBehind })
      }
    } catch (error) {
      void this.logger.verbose({
        message: `Failed to update git status for ${serviceId}: ${(error as Error).message}`,
      })
    }
  }

  public async [Symbol.asyncDispose]() {
    for (const [, entry] of this.watchers) {
      if (entry.debounceTimer) clearTimeout(entry.debounceTimer)
      await entry.watcher.close().catch(() => undefined)
    }
    this.watchers.clear()
    try {
      await this.elevatedInjector?.[Symbol.asyncDispose]()
    } catch {
      // May already be disposed by the parent injector
    }
  }
}

export type GitHeadWatcher = GitHeadWatcherImpl

export const GitHeadWatcher: Token<GitHeadWatcher, 'singleton'> = defineService({
  name: 'app/GitHeadWatcher',
  lifetime: 'singleton',
  factory: ({ inject, injector, onDispose }) => {
    const instance = new GitHeadWatcherImpl(injector, inject(GitService))
    // eslint-disable-next-line furystack/prefer-using-wrapper -- onDispose ties teardown to the injector lifetime; the instance escapes via return.
    onDispose(() => instance[Symbol.asyncDispose]())
    return instance
  },
})
