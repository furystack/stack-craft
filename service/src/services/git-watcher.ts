import { getStoreManager } from '@furystack/core'
import { Injectable, Injected, getInjectorReference } from '@furystack/inject'
import { getLogger } from '@furystack/logging'
import { Service } from 'common'
import { resolveServiceCwd } from '../utils/resolve-service-cwd.js'
import { GitService } from './git-service.js'
import { ProcessManager } from './process-manager.js'
import { WebsocketService } from './websocket-service.js'

type WatchEntry = {
  serviceId: string
  timer: ReturnType<typeof setInterval>
  lastBranches: Set<string>
}

@Injectable({ lifetime: 'singleton' })
export class GitWatcher {
  private watchers = new Map<string, WatchEntry>()

  @Injected((injector) => getLogger(injector).withScope('GitWatcher'))
  declare private logger: ReturnType<ReturnType<typeof getLogger>['withScope']>

  @Injected(GitService)
  declare private git: GitService

  @Injected(WebsocketService)
  declare private ws: WebsocketService

  @Injected(ProcessManager)
  declare private pm: ProcessManager

  public async startWatching(serviceId: string): Promise<void> {
    if (this.watchers.has(serviceId)) return

    const sm = getStoreManager(getInjectorReference(this))
    const services = await sm.getStoreFor(Service, 'id').find({ filter: { id: { $eq: serviceId } }, top: 1 })
    const svc = services[0]

    if (!svc?.autoFetchEnabled || !svc?.repositoryId) return

    const cwd = await resolveServiceCwd(getInjectorReference(this), svc)
    const intervalMs = (svc.autoFetchIntervalMinutes || 60) * 60 * 1000

    const { remote } = await this.git.getBranches(cwd).catch(() => ({ remote: [] as string[] }))

    const entry: WatchEntry = {
      serviceId,
      lastBranches: new Set(remote),
      timer: setInterval(() => void this.fetchAndCheck(serviceId), intervalMs),
    }

    this.watchers.set(serviceId, entry)
    await this.logger.information({
      message: `Started watching service ${svc.displayName} (every ${svc.autoFetchIntervalMinutes}min)`,
    })
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
    if (!entry) return

    const sm = getStoreManager(getInjectorReference(this))
    const services = await sm.getStoreFor(Service, 'id').find({ filter: { id: { $eq: serviceId } }, top: 1 })
    const svc = services[0]
    if (!svc?.repositoryId) return

    const cwd = await resolveServiceCwd(getInjectorReference(this), svc)

    try {
      await this.git.fetch(cwd)
      await sm.getStoreFor(Service, 'id').update(serviceId, {
        lastFetchedAt: new Date().toISOString(),
      } as Partial<Service>)

      const { remote } = await this.git.getBranches(cwd)
      const newBranches = remote.filter((b) => !entry.lastBranches.has(b))

      if (newBranches.length > 0) {
        await this.logger.information({
          message: `New branches detected for ${svc.displayName}: ${newBranches.join(', ')}`,
        })
        entry.lastBranches = new Set(remote)
        void this.ws.announce({
          type: 'git-branches-changed',
          serviceId,
          newBranches,
        })
      }

      if (svc.autoRestartOnFetch) {
        const { updated } = await this.git.pull(cwd)
        if (updated) {
          await this.logger.information({ message: `Changes pulled, restarting ${svc.displayName}` })
          if (svc.installCommand) await this.pm.installService(serviceId)
          if (svc.buildCommand) await this.pm.buildService(serviceId)
          await this.pm.restartService(serviceId)
        }
      }
    } catch (error) {
      await this.logger.warning({
        message: `Git fetch failed for ${svc.displayName}`,
        data: { error },
      })
    }
  }

  public async [Symbol.asyncDispose]() {
    for (const [, entry] of this.watchers) {
      clearInterval(entry.timer)
    }
    this.watchers.clear()
  }
}
