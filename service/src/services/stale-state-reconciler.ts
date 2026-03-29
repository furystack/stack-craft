import { useSystemIdentityContext } from '@furystack/core'
import { Injectable, Injected, type Injector, getInjectorReference } from '@furystack/inject'
import { getLogger } from '@furystack/logging'
import { getRepository } from '@furystack/repository'
import { ServiceDefinition, ServiceStatus } from 'common'

import { resolveServiceCwd } from '../utils/resolve-service-cwd.js'
import { GitHeadWatcher } from './git-head-watcher.js'
import { GitWatcher } from './git-watcher.js'
import type { TriggerContext } from './process-manager.js'
import { ServiceStatusManager } from './service-status-manager.js'

/** Detects and resets stale in-progress states on startup (e.g. services left as "running" after a crash) */
@Injectable({ lifetime: 'singleton' })
export class StaleStateReconciler {
  private elevatedInjector?: Injector

  private getElevatedInjector(): Injector {
    if (!this.elevatedInjector) {
      this.elevatedInjector = useSystemIdentityContext({ injector: getInjectorReference(this) })
    }
    return this.elevatedInjector
  }

  @Injected((injector) => getLogger(injector).withScope('StaleStateReconciler'))
  declare private logger: ReturnType<ReturnType<typeof getLogger>['withScope']>

  @Injected(ServiceStatusManager)
  declare private statusManager: ServiceStatusManager

  @Injected(GitHeadWatcher)
  declare private gitHeadWatcher: GitHeadWatcher

  @Injected(GitWatcher)
  declare private gitWatcher: GitWatcher

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
          message: 'Reconciling stale state',
          data: { serviceId: status.serviceId, update },
        })
        await this.statusManager.updateServiceStatus(
          status.serviceId,
          update,
          'state-reconciled',
          reconcileTrigger,
          staleMetadata,
        )
      }

      if (status.cloneStatus === 'cloned') {
        try {
          const services = await getRepository(elevated)
            .getDataSetFor(ServiceDefinition, 'id')
            .find(elevated, { filter: { id: { $eq: status.serviceId } }, top: 1 })
          const svc = services[0]
          if (svc) {
            const cwd = await resolveServiceCwd(getInjectorReference(this), svc, elevated)
            await this.gitHeadWatcher.watch(status.serviceId, cwd)
            void this.gitWatcher.startWatching(status.serviceId)
          }
        } catch (error) {
          await this.logger.verbose({
            message: `Could not start git watcher for service ${status.serviceId}: ${(error as Error).message}`,
          })
        }
      }
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
