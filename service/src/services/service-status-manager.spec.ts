import { ServiceStateHistoryDataSet } from '../app-models/data-store/tokens.js'
import { getDataSetFor } from '@furystack/repository'
import { InMemoryStore, useSystemIdentityContext } from '@furystack/core'
import { addStore } from '../test-shims.js'
import { Injector } from '@furystack/inject'
import { useLogging, VerboseConsoleLogger } from '@furystack/logging'
import { usingAsync } from '@furystack/utils'
import { ServiceStateHistory, ServiceStatus } from 'common'
import { describe, expect, it } from 'vitest'

import { ServiceStatusManager } from './service-status-manager.js'
import type { TriggerContext } from './trigger-context.js'
import { legacyRepository as getRepository } from '../utils/legacy-repository.js'

const testTrigger: TriggerContext = { triggeredBy: 'test-user', triggerSource: 'api' }

const createTestServiceStatus = (overrides: Partial<ServiceStatus> = {}): ServiceStatus => ({
  serviceId: 'svc-1',
  cloneStatus: 'not-cloned',
  installStatus: 'not-installed',
  buildStatus: 'not-built',
  runStatus: 'stopped',
  updatedAt: new Date().toISOString(),
  ...overrides,
})

const setupStatusManagerInjector = (injector: Injector) => {
  useLogging(injector, VerboseConsoleLogger)

  const historyIdCounter = 0

  const statusStore = new InMemoryStore({ model: ServiceStatus, primaryKey: 'serviceId' })
  const historyStore = new InMemoryStore({ model: ServiceStateHistory, primaryKey: 'id' })

  addStore(injector, statusStore)
  addStore(injector, historyStore)

  // Datasets are declared as module-level tokens with auto-id logic; the
  // legacy createDataSet shim is a no-op kept here for backwards compatibility.
  getRepository(injector).createDataSet(ServiceStatus, 'serviceId', {})
  getRepository(injector).createDataSet(ServiceStateHistory, 'id', {})
  void historyIdCounter

  const manager = injector.get(ServiceStatusManager)

  return { manager, historyStore, statusStore }
}

describe('ServiceStatusManager', () => {
  describe('updateServiceStatus', () => {
    it('should update the ServiceStatus record', () =>
      usingAsync(new Injector(), async (injector) => {
        const { manager, statusStore } = setupStatusManagerInjector(injector)
        await statusStore.add(createTestServiceStatus())

        await manager.updateServiceStatus('svc-1', { runStatus: 'running' }, 'run-started', testTrigger)

        const [updated] = await statusStore.find({ filter: { serviceId: { $eq: 'svc-1' } }, top: 1 })
        expect(updated?.runStatus).toBe('running')
        expect(updated?.updatedAt).toBeDefined()
        expect(updated?.lastStartedAt).toBeDefined()
      }))

    it('should create a history entry', () =>
      usingAsync(new Injector(), async (injector) => {
        const { manager, statusStore, historyStore } = setupStatusManagerInjector(injector)
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
      }))

    it('should record previous and new state in history', () =>
      usingAsync(new Injector(), async (injector) => {
        const { manager, statusStore, historyStore } = setupStatusManagerInjector(injector)
        await statusStore.add(createTestServiceStatus({ installStatus: 'not-installed', buildStatus: 'not-built' }))

        await manager.updateServiceStatus('svc-1', { installStatus: 'installed' }, 'install-completed', testTrigger)

        const [entry] = await historyStore.find({ filter: { serviceId: { $eq: 'svc-1' } } })
        const previousState = JSON.parse(entry.previousState ?? '{}') as Record<string, unknown>
        const newState = JSON.parse(entry.newState ?? '{}') as Record<string, unknown>

        expect(previousState.installStatus).toBe('not-installed')
        expect(newState.installStatus).toBe('installed')
        expect(newState.buildStatus).toBe('not-built')
      }))

    it('should set lastClonedAt when cloneStatus is cloned', () =>
      usingAsync(new Injector(), async (injector) => {
        const { manager, statusStore } = setupStatusManagerInjector(injector)
        await statusStore.add(createTestServiceStatus())

        await manager.updateServiceStatus('svc-1', { cloneStatus: 'cloned' }, 'clone-completed', testTrigger)

        const [updated] = await statusStore.find({ filter: { serviceId: { $eq: 'svc-1' } }, top: 1 })
        expect(updated?.lastClonedAt).toBeDefined()
      }))

    it('should set lastInstalledAt when installStatus is installed', () =>
      usingAsync(new Injector(), async (injector) => {
        const { manager, statusStore } = setupStatusManagerInjector(injector)
        await statusStore.add(createTestServiceStatus())

        await manager.updateServiceStatus('svc-1', { installStatus: 'installed' }, 'install-completed', testTrigger)

        const [updated] = await statusStore.find({ filter: { serviceId: { $eq: 'svc-1' } }, top: 1 })
        expect(updated?.lastInstalledAt).toBeDefined()
      }))

    it('should set lastBuiltAt when buildStatus is built', () =>
      usingAsync(new Injector(), async (injector) => {
        const { manager, statusStore } = setupStatusManagerInjector(injector)
        await statusStore.add(createTestServiceStatus())

        await manager.updateServiceStatus('svc-1', { buildStatus: 'built' }, 'build-completed', testTrigger)

        const [updated] = await statusStore.find({ filter: { serviceId: { $eq: 'svc-1' } }, top: 1 })
        expect(updated?.lastBuiltAt).toBeDefined()
      }))

    it('should do nothing when the status record does not exist', () =>
      usingAsync(new Injector(), async (injector) => {
        const { manager, historyStore } = setupStatusManagerInjector(injector)

        await manager.updateServiceStatus('nonexistent', { runStatus: 'running' }, 'run-started', testTrigger)

        const entries = await historyStore.find({})
        expect(entries).toHaveLength(0)
      }))

    it('should skip history when skipHistory option is set', () =>
      usingAsync(new Injector(), async (injector) => {
        const { manager, statusStore, historyStore } = setupStatusManagerInjector(injector)
        await statusStore.add(createTestServiceStatus())

        await manager.updateServiceStatus('svc-1', { runStatus: 'running' }, 'run-started', testTrigger, undefined, {
          skipHistory: true,
        })

        const [updated] = await statusStore.find({ filter: { serviceId: { $eq: 'svc-1' } }, top: 1 })
        expect(updated?.runStatus).toBe('running')

        const entries = await historyStore.find({})
        expect(entries).toHaveLength(0)
      }))

    it('should store metadata when provided', () =>
      usingAsync(new Injector(), async (injector) => {
        const { manager, statusStore, historyStore } = setupStatusManagerInjector(injector)
        await statusStore.add(createTestServiceStatus())

        await manager.updateServiceStatus('svc-1', { runStatus: 'error' }, 'run-crashed', testTrigger, {
          exitCode: 1,
          message: 'segfault',
        })

        const [entry] = await historyStore.find({ filter: { serviceId: { $eq: 'svc-1' } } })
        const metadata = JSON.parse(entry.metadata ?? '{}') as Record<string, unknown>
        expect(metadata.exitCode).toBe(1)
        expect(metadata.message).toBe('segfault')
      }))

    it('should store processUid when provided', () =>
      usingAsync(new Injector(), async (injector) => {
        const { manager, statusStore, historyStore } = setupStatusManagerInjector(injector)
        await statusStore.add(createTestServiceStatus())

        await manager.updateServiceStatus('svc-1', { runStatus: 'running' }, 'run-started', testTrigger, undefined, {
          processUid: 'abc-123',
        })

        const [entry] = await historyStore.find({ filter: { serviceId: { $eq: 'svc-1' } } })
        expect(entry?.processUid).toBe('abc-123')
      }))
  })

  describe('pruneHistory', () => {
    it('should remove entries beyond the limit', () =>
      usingAsync(new Injector(), async (injector) => {
        const { manager, statusStore, historyStore } = setupStatusManagerInjector(injector)
        await statusStore.add(createTestServiceStatus())

        const elevated = useSystemIdentityContext({ injector })
        const historyDs = getDataSetFor(elevated, ServiceStateHistoryDataSet)

        const entries: ServiceStateHistory[] = Array.from({ length: 10_005 }, (_, i) => ({
          id: i + 1,
          serviceId: 'svc-1',
          event: 'run-started',
          triggeredBy: 'test',
          triggerSource: 'api',
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
      }))

    it('should do nothing when history is within limits', () =>
      usingAsync(new Injector(), async (injector) => {
        const { manager, statusStore, historyStore } = setupStatusManagerInjector(injector)
        await statusStore.add(createTestServiceStatus())

        const elevated = useSystemIdentityContext({ injector })
        const historyDs = getDataSetFor(elevated, ServiceStateHistoryDataSet)

        const entries: ServiceStateHistory[] = Array.from({ length: 5 }, (_, i) => ({
          id: i + 1,
          serviceId: 'svc-1',
          event: 'run-started',
          triggeredBy: 'test',
          triggerSource: 'api',
          createdAt: new Date().toISOString(),
        }))
        await historyStore.add(...entries)

        await manager.pruneHistory('svc-1', elevated)

        const countAfter = await historyDs.count(elevated, { serviceId: { $eq: 'svc-1' } })
        expect(countAfter).toBe(5)

        await elevated[Symbol.asyncDispose]()
      }))
  })
})
