import { useSystemIdentityContext } from '@furystack/core'
import { Injectable, Injected, type Injector, getInjectorReference } from '@furystack/inject'
import { getLogger } from '@furystack/logging'
import { getRepository } from '@furystack/repository'
import { ServiceGitStatus } from 'common'
import { existsSync } from 'fs'
import { watch, type FSWatcher } from 'fs'
import { join } from 'path'

import { GitService } from './git-service.js'

type WatchedEntry = {
  cwd: string
  watcher: FSWatcher
  debounceTimer?: ReturnType<typeof setTimeout>
}

const DEBOUNCE_MS = 200

@Injectable({ lifetime: 'singleton' })
export class GitHeadWatcher {
  private watchers = new Map<string, WatchedEntry>()
  private elevatedInjector?: Injector

  private getElevatedInjector(): Injector {
    if (!this.elevatedInjector) {
      this.elevatedInjector = useSystemIdentityContext({ injector: getInjectorReference(this) })
    }
    return this.elevatedInjector
  }

  @Injected((injector) => getLogger(injector).withScope('GitHeadWatcher'))
  declare private logger: ReturnType<ReturnType<typeof getLogger>['withScope']>

  @Injected(GitService)
  declare private git: GitService

  /**
   * Starts watching `.git/HEAD` for a cloned service.
   * Reads the current branch immediately and writes it to the in-memory store.
   */
  public async watch(serviceId: string, cwd: string): Promise<void> {
    this.unwatch(serviceId)

    const headPath = join(cwd, '.git', 'HEAD')
    if (!existsSync(headPath)) return

    const branch = await this.readBranch(serviceId, cwd)
    await this.upsertGitStatus(serviceId, branch)

    try {
      const watcher = watch(headPath, () => {
        const entry = this.watchers.get(serviceId)
        if (!entry) return
        if (entry.debounceTimer) clearTimeout(entry.debounceTimer)
        entry.debounceTimer = setTimeout(() => {
          void this.onHeadChanged(serviceId, cwd)
        }, DEBOUNCE_MS)
      })

      this.watchers.set(serviceId, { cwd, watcher })
    } catch {
      void this.logger.verbose({ message: `Could not watch .git/HEAD for service ${serviceId}` })
    }
  }

  public unwatch(serviceId: string): void {
    const entry = this.watchers.get(serviceId)
    if (entry) {
      if (entry.debounceTimer) clearTimeout(entry.debounceTimer)
      entry.watcher.close()
      this.watchers.delete(serviceId)
    }
  }

  private async onHeadChanged(serviceId: string, cwd: string): Promise<void> {
    const branch = await this.readBranch(serviceId, cwd)
    const commitsBehind = branch ? await this.git.getCommitsBehind(cwd, branch).catch(() => 0) : undefined
    await this.upsertGitStatus(serviceId, branch, commitsBehind)
  }

  private async readBranch(serviceId: string, cwd: string): Promise<string | undefined> {
    try {
      return await this.git.getCurrentBranch(cwd)
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
      const ds = getRepository(elevated).getDataSetFor(ServiceGitStatus, 'serviceId')
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
      entry.watcher.close()
    }
    this.watchers.clear()
    try {
      await this.elevatedInjector?.[Symbol.asyncDispose]()
    } catch {
      // May already be disposed by the parent injector
    }
  }
}
