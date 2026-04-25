import { ServiceStateHistoryDataSet, ServiceStatusDataSet } from '../app-models/data-store/tokens.js'
import { getDataSetFor } from '@furystack/repository'
import { useSystemIdentityContext } from '@furystack/core'
import { type Injector, defineService, type Token } from '@furystack/inject'
import { getLogger } from '@furystack/logging'
import type { BuildStatus, CloneStatus, InstallStatus, RunStatus, ServiceStateEvent } from 'common'
import type { ServiceStatus } from 'common'
import type { TriggerContext } from './trigger-context.js'
const MAX_HISTORY_PER_SERVICE = 10_000
const HISTORY_PRUNE_CHECK_INTERVAL = 100

/** Manages service lifecycle status transitions and records state change history with automatic pruning */
class ServiceStatusManagerImpl {
  private logger!: ReturnType<ReturnType<typeof getLogger>['withScope']>

  constructor(public readonly injector: Injector) {
    this.logger = getLogger(injector).withScope('ServiceStatusManager')
  }

  private elevatedInjector?: Injector
  private historyInsertCounts = new Map<string, number>()

  private getElevatedInjector(): Injector {
    if (!this.elevatedInjector) {
      this.elevatedInjector = useSystemIdentityContext({ injector: this.injector })
    }
    return this.elevatedInjector
  }

  public async updateServiceStatus(
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
      const statusDs = getDataSetFor(elevated, ServiceStatusDataSet)

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
        const historyDs = getDataSetFor(elevated, ServiceStateHistoryDataSet)

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

        const count = (this.historyInsertCounts.get(serviceId) ?? 0) + 1
        if (count >= HISTORY_PRUNE_CHECK_INTERVAL) {
          this.historyInsertCounts.set(serviceId, 0)
          void this.pruneHistory(serviceId, elevated)
        } else {
          this.historyInsertCounts.set(serviceId, count)
        }
      }
    } catch (e) {
      void this.logger.warning({
        message: `Failed to update service status for ${serviceId}`,
        data: { error: e instanceof Error ? e.message : e },
      })
    }
  }

  public async pruneHistory(serviceId: string, elevated?: Injector): Promise<void> {
    const injector = elevated ?? this.getElevatedInjector()
    try {
      const historyDs = getDataSetFor(injector, ServiceStateHistoryDataSet)
      const count = await historyDs.count(injector, { serviceId: { $eq: serviceId } })
      if (count <= MAX_HISTORY_PER_SERVICE) return

      const excess = count - MAX_HISTORY_PER_SERVICE
      const oldEntries = await historyDs.find(injector, {
        filter: { serviceId: { $eq: serviceId } },
        order: { id: 'ASC' },
        top: excess,
        select: ['id'],
      })

      if (oldEntries.length > 0) {
        await historyDs.remove(injector, ...oldEntries.map((e) => e.id))
        await this.logger.verbose({
          message: `Pruned ${oldEntries.length} old history entries for service ${serviceId}`,
        })
      }
    } catch (e) {
      void this.logger.warning({
        message: `Failed to prune history for service ${serviceId}`,
        data: { error: e instanceof Error ? e.message : e },
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

export type ServiceStatusManager = ServiceStatusManagerImpl

export const ServiceStatusManager: Token<ServiceStatusManager, 'singleton'> = defineService({
  name: 'app/ServiceStatusManager',
  lifetime: 'singleton',
  factory: ({ injector }) => new ServiceStatusManagerImpl(injector),
})
