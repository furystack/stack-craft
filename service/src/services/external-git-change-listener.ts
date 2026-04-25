import { useSystemIdentityContext } from '@furystack/core'
import { Injectable, Injected, type Injector, getInjectorReference } from '@furystack/inject'
import { getLogger } from '@furystack/logging'
import { getRepository } from '@furystack/repository'
import type { BuildStatus, InstallStatus, ServiceStateEvent } from 'common'
import { ServiceStatus } from 'common'

import { GitHeadWatcher, type GitHeadChangeEvent } from './git-head-watcher.js'
import { ServiceStatusManager } from './service-status-manager.js'
import type { TriggerContext } from './trigger-context.js'

const EXTERNAL_TRIGGER: TriggerContext = { triggeredBy: 'system', triggerSource: 'system' }

/**
 * Bridges `GitHeadWatcher.externalChange` events to status updates:
 * records a history entry, marks downstream pipeline stages as `'stale'`,
 * and clears outdated errors.
 */
@Injectable({ lifetime: 'singleton' })
export class ExternalGitChangeListener {
  private started = false
  private elevatedInjector?: Injector

  private getElevatedInjector(): Injector {
    if (!this.elevatedInjector) {
      this.elevatedInjector = useSystemIdentityContext({ injector: getInjectorReference(this) })
    }
    return this.elevatedInjector
  }

  @Injected((injector) => getLogger(injector).withScope('ExternalGitChangeListener'))
  declare private logger: ReturnType<ReturnType<typeof getLogger>['withScope']>

  @Injected(GitHeadWatcher)
  declare private gitHeadWatcher: GitHeadWatcher

  @Injected(ServiceStatusManager)
  declare private statusManager: ServiceStatusManager

  public start(): void {
    if (this.started) return
    this.started = true
    this.gitHeadWatcher.on('externalChange', (event) => {
      void this.handleExternalChange(event)
    })
  }

  private async handleExternalChange(event: GitHeadChangeEvent): Promise<void> {
    const eventName: ServiceStateEvent =
      event.kind === 'branch-switched' ? 'external-branch-changed' : 'external-pull-detected'

    const metadata = {
      previousBranch: event.previousBranch,
      currentBranch: event.currentBranch,
      previousSha: event.previousSha,
      currentSha: event.currentSha,
    }

    try {
      await this.statusManager.updateServiceStatus(event.serviceId, {}, eventName, EXTERNAL_TRIGGER, metadata)
    } catch (error) {
      void this.logger.verbose({
        message: `Failed to record external git event for ${event.serviceId}: ${(error as Error).message}`,
      })
    }

    try {
      const elevated = this.getElevatedInjector()
      const statusDs = getRepository(elevated).getDataSetFor(ServiceStatus, 'serviceId')
      const statuses = await statusDs.find(elevated, { filter: { serviceId: { $eq: event.serviceId } }, top: 1 })
      const status = statuses[0]
      if (!status) return

      const update: { installStatus?: InstallStatus; buildStatus?: BuildStatus } = {}
      if (status.installStatus === 'installed') update.installStatus = 'stale'
      if (status.buildStatus === 'built') update.buildStatus = 'stale'

      if (update.installStatus || update.buildStatus) {
        await this.statusManager.updateServiceStatus(event.serviceId, update, 'marked-stale', EXTERNAL_TRIGGER, {
          reason: `External git ${event.kind}`,
        })
      }
    } catch (error) {
      void this.logger.verbose({
        message: `Failed to mark downstream stale for ${event.serviceId}: ${(error as Error).message}`,
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
