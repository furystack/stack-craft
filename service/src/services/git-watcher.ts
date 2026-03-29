import { Injectable, Injected, type Injector, getInjectorReference } from '@furystack/inject'
import { getLogger } from '@furystack/logging'
import { getRepository } from '@furystack/repository'
import { ServiceConfig, ServiceDefinition, ServiceStatus } from 'common'

import { useSystemIdentityContext } from '@furystack/core'
import { resolveServiceCwd } from '../utils/resolve-service-cwd.js'
import { GitService } from './git-service.js'
import { ProcessManager } from './process-manager.js'

type WatchEntry = {
  serviceId: string
  timer: ReturnType<typeof setInterval>
  lastBranches: Set<string>
  isFetching: boolean
}

@Injectable({ lifetime: 'singleton' })
export class GitWatcher {
  private watchers = new Map<string, WatchEntry>()
  private elevatedInjector?: Injector

  private getElevatedInjector(): Injector {
    if (!this.elevatedInjector) {
      this.elevatedInjector = useSystemIdentityContext({ injector: getInjectorReference(this) })
    }
    return this.elevatedInjector
  }

  @Injected((injector) => getLogger(injector).withScope('GitWatcher'))
  declare private logger: ReturnType<ReturnType<typeof getLogger>['withScope']>

  @Injected(GitService)
  declare private git: GitService

  @Injected(ProcessManager)
  declare private pm: ProcessManager

  public async startWatching(serviceId: string): Promise<void> {
    if (this.watchers.has(serviceId)) return

    const elevated = this.getElevatedInjector()
    const svcDefDs = getRepository(elevated).getDataSetFor(ServiceDefinition, 'id')
    const svcConfigDs = getRepository(elevated).getDataSetFor(ServiceConfig, 'serviceId')

    const defs = await svcDefDs.find(elevated, { filter: { id: { $eq: serviceId } }, top: 1 })
    const svc = defs[0]
    if (!svc?.repositoryId) return

    const configs = await svcConfigDs.find(elevated, { filter: { serviceId: { $eq: serviceId } }, top: 1 })
    const config = configs[0]
    if (!config?.autoFetchEnabled) return

    const cwd = await resolveServiceCwd(getInjectorReference(this), svc, elevated)
    const intervalMs = (config.autoFetchIntervalMinutes ?? 60) * 60 * 1000

    const { remote } = await this.git.getBranches(cwd).catch(() => ({ remote: [] as string[] }))

    const entry: WatchEntry = {
      serviceId,
      lastBranches: new Set(remote),
      isFetching: false,
      timer: setInterval(() => void this.fetchAndCheck(serviceId), intervalMs),
    }

    this.watchers.set(serviceId, entry)
    await this.logger.information({
      message: `Started watching service ${svc.displayName} (every ${config.autoFetchIntervalMinutes}min)`,
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
    if (!entry || entry.isFetching) return

    entry.isFetching = true
    const elevated = this.getElevatedInjector()
    const svcDefDs = getRepository(elevated).getDataSetFor(ServiceDefinition, 'id')
    const svcConfigDs = getRepository(elevated).getDataSetFor(ServiceConfig, 'serviceId')
    const statusDs = getRepository(elevated).getDataSetFor(ServiceStatus, 'serviceId')

    const defs = await svcDefDs.find(elevated, { filter: { id: { $eq: serviceId } }, top: 1 })
    const svc = defs[0]
    if (!svc?.repositoryId) return

    const configs = await svcConfigDs.find(elevated, { filter: { serviceId: { $eq: serviceId } }, top: 1 })
    const config = configs[0]

    const cwd = await resolveServiceCwd(getInjectorReference(this), svc, elevated)

    try {
      await this.git.fetch(cwd)
      await statusDs.update(elevated, serviceId, { lastFetchedAt: new Date().toISOString() })

      const { remote } = await this.git.getBranches(cwd)
      const newBranches = remote.filter((b) => !entry.lastBranches.has(b))

      if (newBranches.length > 0) {
        await this.logger.information({
          message: `New branches detected for ${svc.displayName}: ${newBranches.join(', ')}`,
        })
        entry.lastBranches = new Set(remote)
      }

      if (config?.autoRestartOnFetch) {
        const autoRestartTrigger = { triggeredBy: 'system', triggerSource: 'auto-restart' as const }
        const { updated } = await this.git.pull(cwd)
        if (updated) {
          await this.logger.information({ message: `Changes pulled, restarting ${svc.displayName}` })
          if (svc.installCommand) await this.pm.installService(serviceId, autoRestartTrigger)
          if (svc.buildCommand) await this.pm.buildService(serviceId, autoRestartTrigger)
          await this.pm.restartService(serviceId, autoRestartTrigger)
        }
      }
    } catch (error) {
      await this.logger.warning({
        message: `Git fetch failed for ${svc.displayName}`,
        data: { error },
      })
    } finally {
      entry.isFetching = false
    }
  }

  public async [Symbol.asyncDispose]() {
    try {
      await this.elevatedInjector?.[Symbol.asyncDispose]()
    } catch {
      // May already be disposed by the parent injector
    }
    for (const [, entry] of this.watchers) {
      clearInterval(entry.timer)
    }
    this.watchers.clear()
  }
}
