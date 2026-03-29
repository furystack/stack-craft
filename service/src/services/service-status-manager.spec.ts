import { addStore, InMemoryStore, useSystemIdentityContext } from '@furystack/core'
import { Injector } from '@furystack/inject'
import { useLogging, VerboseConsoleLogger } from '@furystack/logging'
import { getRepository } from '@furystack/repository'
import { ServiceStateHistory, ServiceStatus } from 'common'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import type { TriggerSource } from 'common'

import type { TriggerContext } from './process-manager.js'
import { ServiceStatusManager } from './service-status-manager.js'

const testTrigger: TriggerContext = { triggeredBy: 'test-user', triggerSource: 'api' as TriggerSource }

const createTestServiceStatus = (overrides: Partial<ServiceStatus> = {}): ServiceStatus => ({
  serviceId: 'svc-1',
  cloneStatus: 'not-cloned',
  installStatus: 'not-installed',
  buildStatus: 'not-built',
  runStatus: 'stopped',
  updatedAt: new Date().toISOString(),
  ...overrides,
})

describe('ServiceStatusManager', () => {
  let injector: Injector
  let manager: ServiceStatusManager
  let historyStore: InMemoryStore<ServiceStateHistory, 'id'>
  let statusStore: InMemoryStore<ServiceStatus, 'serviceId'>
  let historyIdCounter: number

  beforeEach(() => {
    injector = new Injector()
    useLogging(injector, VerboseConsoleLogger)

    historyIdCounter = 0

    statusStore = new InMemoryStore({ model: ServiceStatus, primaryKey: 'serviceId' })
    historyStore = new InMemoryStore({ model: ServiceStateHistory, primaryKey: 'id' })

    addStore(injector, statusStore)
    addStore(injector, historyStore)

    getRepository(injector).createDataSet(ServiceStatus, 'serviceId', {})
    getRepository(injector).createDataSet(ServiceStateHistory, 'id', {
      modifyOnAdd: async ({ entity }) => {
        historyIdCounter++
        return { ...entity, id: historyIdCounter }
      },
    })

    manager = injector.getInstance(ServiceStatusManager)
  })

  afterEach(async () => {
    await manager[Symbol.asyncDispose]()
    try {
      await injector[Symbol.asyncDispose]()
    } catch {
      // May already be disposed
    }
  })

  describe('updateServiceStatus', () => {
    it('should update the ServiceStatus record', async () => {
      await statusStore.add(createTestServiceStatus())

      await manager.updateServiceStatus('svc-1', { runStatus: 'running' }, 'run-started', testTrigger)

      const [updated] = await statusStore.find({ filter: { serviceId: { $eq: 'svc-1' } }, top: 1 })
      expect(updated?.runStatus).toBe('running')
      expect(updated?.updatedAt).toBeDefined()
      expect(updated?.lastStartedAt).toBeDefined()
    })

    it('should create a history entry', async () => {
      await statusStore.add(createTestServiceStatus())

      await manager.updateServiceStatus('svc-1', { installStatus: 'installed' }, 'install-completed', testTrigger)

      const entries = await historyStore.find({ filter: { serviceId: { $eq: 'svc-1' } } })
      expect(entries).toHaveLength(1)

      const entry = entries[0]
      expect(entry?.serviceId).toBe('svc-1')
      expect(entry?.event).toBe('install-completed')
      expect(entry?.triggeredBy).toBe('test-user')
      expect(entry?.triggerSource).toBe('api')
      expect(entry?.createdAt).toBeDefined()
    })

    it('should record previous and new state in history', async () => {
      await statusStore.add(createTestServiceStatus({ installStatus: 'not-installed', buildStatus: 'not-built' }))

      await manager.updateServiceStatus('svc-1', { installStatus: 'installed' }, 'install-completed', testTrigger)

      const [entry] = await historyStore.find({ filter: { serviceId: { $eq: 'svc-1' } } })
      const previousState = JSON.parse(entry.previousState ?? '{}') as Record<string, unknown>
      const newState = JSON.parse(entry.newState ?? '{}') as Record<string, unknown>

      expect(previousState.installStatus).toBe('not-installed')
      expect(newState.installStatus).toBe('installed')
      expect(newState.buildStatus).toBe('not-built')
    })

    it('should set lastClonedAt when cloneStatus is cloned', async () => {
      await statusStore.add(createTestServiceStatus())

      await manager.updateServiceStatus('svc-1', { cloneStatus: 'cloned' }, 'clone-completed', testTrigger)

      const [updated] = await statusStore.find({ filter: { serviceId: { $eq: 'svc-1' } }, top: 1 })
      expect(updated?.lastClonedAt).toBeDefined()
    })

    it('should set lastInstalledAt when installStatus is installed', async () => {
      await statusStore.add(createTestServiceStatus())

      await manager.updateServiceStatus('svc-1', { installStatus: 'installed' }, 'install-completed', testTrigger)

      const [updated] = await statusStore.find({ filter: { serviceId: { $eq: 'svc-1' } }, top: 1 })
      expect(updated?.lastInstalledAt).toBeDefined()
    })

    it('should set lastBuiltAt when buildStatus is built', async () => {
      await statusStore.add(createTestServiceStatus())

      await manager.updateServiceStatus('svc-1', { buildStatus: 'built' }, 'build-completed', testTrigger)

      const [updated] = await statusStore.find({ filter: { serviceId: { $eq: 'svc-1' } }, top: 1 })
      expect(updated?.lastBuiltAt).toBeDefined()
    })

    it('should do nothing when the status record does not exist', async () => {
      await manager.updateServiceStatus('nonexistent', { runStatus: 'running' }, 'run-started', testTrigger)

      const entries = await historyStore.find({})
      expect(entries).toHaveLength(0)
    })

    it('should skip history when skipHistory option is set', async () => {
      await statusStore.add(createTestServiceStatus())

      await manager.updateServiceStatus('svc-1', { runStatus: 'running' }, 'run-started', testTrigger, undefined, {
        skipHistory: true,
      })

      const [updated] = await statusStore.find({ filter: { serviceId: { $eq: 'svc-1' } }, top: 1 })
      expect(updated?.runStatus).toBe('running')

      const entries = await historyStore.find({})
      expect(entries).toHaveLength(0)
    })

    it('should store metadata when provided', async () => {
      await statusStore.add(createTestServiceStatus())

      await manager.updateServiceStatus('svc-1', { runStatus: 'error' }, 'run-crashed', testTrigger, {
        exitCode: 1,
        message: 'segfault',
      })

      const [entry] = await historyStore.find({ filter: { serviceId: { $eq: 'svc-1' } } })
      const metadata = JSON.parse(entry.metadata ?? '{}') as Record<string, unknown>
      expect(metadata.exitCode).toBe(1)
      expect(metadata.message).toBe('segfault')
    })

    it('should store processUid when provided', async () => {
      await statusStore.add(createTestServiceStatus())

      await manager.updateServiceStatus('svc-1', { runStatus: 'running' }, 'run-started', testTrigger, undefined, {
        processUid: 'abc-123',
      })

      const [entry] = await historyStore.find({ filter: { serviceId: { $eq: 'svc-1' } } })
      expect(entry?.processUid).toBe('abc-123')
    })
  })

  describe('pruneHistory', () => {
    it('should remove entries beyond the limit', async () => {
      await statusStore.add(createTestServiceStatus())

      const elevated = useSystemIdentityContext({ injector })
      const historyDs = getRepository(elevated).getDataSetFor(ServiceStateHistory, 'id')

      const entries = Array.from({ length: 10_005 }, (_, i) => ({
        id: i + 1,
        serviceId: 'svc-1',
        event: 'run-started' as const,
        triggeredBy: 'test',
        triggerSource: 'api' as TriggerSource,
        createdAt: new Date().toISOString(),
      }))

      for (let i = 0; i < entries.length; i += 500) {
        await historyStore.add(...entries.slice(i, i + 500))
      }

      const countBefore = await historyDs.count(elevated, { serviceId: { $eq: 'svc-1' } })
      expect(countBefore).toBe(10_005)

      await manager.pruneHistory('svc-1', elevated)

      const countAfter = await historyDs.count(elevated, { serviceId: { $eq: 'svc-1' } })
      expect(countAfter).toBe(10_000)

      await elevated[Symbol.asyncDispose]()
    })

    it('should do nothing when history is within limits', async () => {
      await statusStore.add(createTestServiceStatus())

      const elevated = useSystemIdentityContext({ injector })
      const historyDs = getRepository(elevated).getDataSetFor(ServiceStateHistory, 'id')

      const entries = Array.from({ length: 5 }, (_, i) => ({
        id: i + 1,
        serviceId: 'svc-1',
        event: 'run-started' as const,
        triggeredBy: 'test',
        triggerSource: 'api' as TriggerSource,
        createdAt: new Date().toISOString(),
      }))
      await historyStore.add(...entries)

      await manager.pruneHistory('svc-1', elevated)

      const countAfter = await historyDs.count(elevated, { serviceId: { $eq: 'svc-1' } })
      expect(countAfter).toBe(5)

      await elevated[Symbol.asyncDispose]()
    })
  })
})
