import { ServiceLogEntryDataSet } from '../app-models/logs/setup-log-store.js'
import { getDataSetFor } from '@furystack/repository'
import { useSystemIdentityContext } from '@furystack/core'
import type { FilterType } from '@furystack/core'
import { type Injector, defineService, type Token } from '@furystack/inject'
import { getLogger } from '@furystack/logging'
import type { ServiceLogEntry } from 'common'
const MAX_ENTRIES_PER_SERVICE = 50_000
const PRUNE_CHECK_INTERVAL = 1_000

/** Persists and queries service process log entries, with automatic pruning to cap storage per service */
class LogStorageServiceImpl {
  private logger!: ReturnType<ReturnType<typeof getLogger>['withScope']>

  constructor(public readonly injector: Injector) {
    this.logger = getLogger(injector).withScope('LogStorageService')
  }

  private elevatedInjector?: Injector
  private insertCount = 0

  private getElevatedInjector(): Injector {
    if (!this.elevatedInjector) {
      this.elevatedInjector = useSystemIdentityContext({ injector: this.injector })
    }
    return this.elevatedInjector
  }

  public async addEntry(
    serviceId: string,
    processUid: string,
    stream: 'stdout' | 'stderr',
    line: string,
  ): Promise<void> {
    const elevated = this.getElevatedInjector()
    const ds = getDataSetFor(elevated, ServiceLogEntryDataSet)
    await ds.add(elevated, {
      serviceId,
      processUid,
      stream,
      line,
      createdAt: new Date().toISOString(),
    })

    this.insertCount++
    if (this.insertCount >= PRUNE_CHECK_INTERVAL) {
      this.insertCount = 0
      void this.prune(serviceId, MAX_ENTRIES_PER_SERVICE)
    }
  }

  public async getEntries(
    serviceId: string,
    options?: { limit?: number; processUid?: string; search?: string },
  ): Promise<ServiceLogEntry[]> {
    const elevated = this.getElevatedInjector()
    const ds = getDataSetFor(elevated, ServiceLogEntryDataSet)

    const filter: FilterType<ServiceLogEntry> = {
      serviceId: { $eq: serviceId },
    }

    if (options?.processUid) {
      filter.processUid = { $eq: options.processUid }
    }

    if (options?.search) {
      filter.line = { $like: `%${options.search}%` }
    }

    return ds.find(elevated, {
      filter,
      order: { id: 'DESC' },
      top: options?.limit ?? 300,
    })
  }

  public async clearLogs(serviceId: string): Promise<void> {
    const elevated = this.getElevatedInjector()
    const ds = getDataSetFor(elevated, ServiceLogEntryDataSet)

    const BATCH_SIZE = 1_000
    let totalRemoved = 0

    for (;;) {
      const batch = await ds.find(elevated, {
        filter: { serviceId: { $eq: serviceId } },
        select: ['id'],
        top: BATCH_SIZE,
      })

      if (batch.length === 0) break

      await ds.remove(elevated, ...batch.map((entry) => entry.id))
      totalRemoved += batch.length
    }

    if (totalRemoved > 0) {
      await this.logger.information({ message: `Cleared ${totalRemoved} log entries for service ${serviceId}` })
    }
  }

  public async prune(serviceId: string, maxEntries: number): Promise<void> {
    const elevated = this.getElevatedInjector()
    const ds = getDataSetFor(elevated, ServiceLogEntryDataSet)

    const count = await ds.count(elevated, { serviceId: { $eq: serviceId } })
    if (count <= maxEntries) return

    const excess = count - maxEntries
    const oldEntries = await ds.find(elevated, {
      filter: { serviceId: { $eq: serviceId } },
      order: { id: 'ASC' },
      top: excess,
      select: ['id'],
    })

    if (oldEntries.length > 0) {
      await ds.remove(elevated, ...oldEntries.map((entry) => entry.id))
      await this.logger.verbose({ message: `Pruned ${oldEntries.length} old log entries for service ${serviceId}` })
    }
  }

  public async [Symbol.asyncDispose]() {
    try {
      await this.elevatedInjector?.[Symbol.asyncDispose]()
    } catch {
      // May already be disposed by parent
    }
  }
}

export type LogStorageService = LogStorageServiceImpl

export const LogStorageService: Token<LogStorageService, 'singleton'> = defineService({
  name: 'app/LogStorageService',
  lifetime: 'singleton',
  factory: ({ injector }) => new LogStorageServiceImpl(injector),
})
