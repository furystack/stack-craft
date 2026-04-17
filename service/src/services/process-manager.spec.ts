import { addStore, InMemoryStore, useSystemIdentityContext } from '@furystack/core'
import { Injector } from '@furystack/inject'
import { useLogging, VerboseConsoleLogger } from '@furystack/logging'
import { getRepository } from '@furystack/repository'
import { usingAsync } from '@furystack/utils'
import {
  GitHubRepository,
  Prerequisite,
  ServiceConfig,
  ServiceDefinition,
  ServiceDependencyLink,
  ServiceGitStatus,
  ServiceLogEntry,
  ServicePrerequisiteLink,
  ServiceStateHistory,
  ServiceStatus,
  StackConfig,
} from 'common'
import { tmpdir } from 'os'
import { describe, expect, it, vi } from 'vitest'

import type { TriggerSource } from 'common'

import { GitHeadWatcher } from './git-head-watcher.js'
import { LogStorageService } from './log-storage-service.js'
import { ProcessManager } from './process-manager.js'

const testTrigger = { triggeredBy: 'test', triggerSource: 'api' as TriggerSource }

const createTestServiceDefinition = (overrides: Partial<ServiceDefinition> = {}): ServiceDefinition => ({
  id: 'svc-1',
  stackName: 'test-stack',
  displayName: 'Test Service',
  description: '',
  workingDirectory: '',
  runCommand: 'echo hello',
  installCommand: 'echo install',
  buildCommand: 'echo build',
  files: [],
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  ...overrides,
})

const createTestServiceStatus = (overrides: Partial<ServiceStatus> = {}): ServiceStatus => ({
  serviceId: 'svc-1',
  cloneStatus: 'not-cloned',
  installStatus: 'not-installed',
  buildStatus: 'not-built',
  runStatus: 'stopped',
  updatedAt: new Date().toISOString(),
  ...overrides,
})

const setupStoreInjector = (injector: Injector) => {
  useLogging(injector, VerboseConsoleLogger)
  const serviceDefStore = new InMemoryStore({ model: ServiceDefinition, primaryKey: 'id' })
  const serviceStatusStore = new InMemoryStore({ model: ServiceStatus, primaryKey: 'serviceId' })
  addStore(injector, serviceDefStore).addStore(serviceStatusStore)
  getRepository(injector).createDataSet(ServiceDefinition, 'id', {})
  getRepository(injector).createDataSet(ServiceStatus, 'serviceId', {})
  return { serviceDefStore, serviceStatusStore }
}

const seedService = async (injector: Injector, overrides: Partial<ServiceDefinition> = {}) => {
  const elevated = useSystemIdentityContext({ injector })
  const svcDef = createTestServiceDefinition(overrides)
  await getRepository(elevated).getDataSetFor(ServiceDefinition, 'id').add(elevated, svcDef)
  await getRepository(elevated)
    .getDataSetFor(ServiceStatus, 'serviceId')
    .add(elevated, createTestServiceStatus({ serviceId: svcDef.id }))
  await getRepository(elevated).getDataSetFor(ServiceConfig, 'serviceId').add(elevated, {
    serviceId: svcDef.id,
    autoFetchEnabled: false,
    autoFetchIntervalMinutes: 60,
    autoRestartOnFetch: false,
    environmentVariableOverrides: {},
    localFiles: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  })
  await elevated[Symbol.asyncDispose]()
}

const setupPmInjector = async (injector: Injector) => {
  useLogging(injector, VerboseConsoleLogger)

  addStore(injector, new InMemoryStore({ model: ServiceDefinition, primaryKey: 'id' }))
  addStore(injector, new InMemoryStore({ model: ServiceConfig, primaryKey: 'serviceId' }))
  addStore(injector, new InMemoryStore({ model: ServiceStatus, primaryKey: 'serviceId' }))
  addStore(injector, new InMemoryStore({ model: StackConfig, primaryKey: 'stackName' }))
  addStore(injector, new InMemoryStore({ model: GitHubRepository, primaryKey: 'id' }))
  addStore(injector, new InMemoryStore({ model: Prerequisite, primaryKey: 'id' }))
  addStore(injector, new InMemoryStore({ model: ServiceLogEntry, primaryKey: 'id' }))
  addStore(injector, new InMemoryStore({ model: ServiceStateHistory, primaryKey: 'id' }))
  addStore(injector, new InMemoryStore({ model: ServiceGitStatus, primaryKey: 'serviceId' }))
  addStore(injector, new InMemoryStore({ model: ServicePrerequisiteLink, primaryKey: 'id' }))
  addStore(injector, new InMemoryStore({ model: ServiceDependencyLink, primaryKey: 'id' }))

  getRepository(injector).createDataSet(ServiceDefinition, 'id', {})
  getRepository(injector).createDataSet(ServiceConfig, 'serviceId', {})
  getRepository(injector).createDataSet(ServiceStatus, 'serviceId', {})
  getRepository(injector).createDataSet(ServiceGitStatus, 'serviceId', {})
  getRepository(injector).createDataSet(StackConfig, 'stackName', {})
  getRepository(injector).createDataSet(GitHubRepository, 'id', {})
  getRepository(injector).createDataSet(Prerequisite, 'id', {})
  getRepository(injector).createDataSet(ServiceLogEntry, 'id', {})
  getRepository(injector).createDataSet(ServiceStateHistory, 'id', {})
  getRepository(injector).createDataSet(ServicePrerequisiteLink, 'id', {})
  getRepository(injector).createDataSet(ServiceDependencyLink, 'id', {})

  const mockGitHeadWatcher = { watch: vi.fn().mockResolvedValue(undefined), unwatch: vi.fn() }
  injector.setExplicitInstance(mockGitHeadWatcher as unknown as GitHeadWatcher, GitHeadWatcher)

  const mockLogStorage = {
    addEntry: vi.fn().mockResolvedValue(undefined),
    getEntries: vi.fn().mockResolvedValue([]),
  }
  injector.setExplicitInstance(mockLogStorage as unknown as LogStorageService, LogStorageService)

  const elevated = useSystemIdentityContext({ injector })
  await getRepository(elevated).getDataSetFor(StackConfig, 'stackName').add(elevated, {
    stackName: 'test-stack',
    mainDirectory: tmpdir(),
    environmentVariables: {},
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  })
  await elevated[Symbol.asyncDispose]()

  await seedService(injector)
  const pm = injector.getInstance(ProcessManager)

  return { pm }
}

const withPmContext = async (fn: (ctx: { injector: Injector; pm: ProcessManager }) => Promise<void>) => {
  const injector = new Injector()
  const { pm } = await setupPmInjector(injector)
  try {
    await fn({ injector, pm })
  } finally {
    await pm[Symbol.asyncDispose]()
    await new Promise((r) => setTimeout(r, 50))
    try {
      await injector[Symbol.asyncDispose]()
    } catch {
      // PM's singleton disposal may already have disposed child injectors
    }
  }
}

describe('ProcessManager - Store Operations', () => {
  describe('Service status transitions', () => {
    it('should store a service definition and status with initial stopped status', () =>
      usingAsync(new Injector(), async (injector) => {
        const { serviceDefStore, serviceStatusStore } = setupStoreInjector(injector)

        await serviceDefStore.add(createTestServiceDefinition())
        await serviceStatusStore.add(createTestServiceStatus())

        const [svc] = await serviceDefStore.find({ filter: { id: { $eq: 'svc-1' } }, top: 1 })
        expect(svc).toBeDefined()

        const [status] = await serviceStatusStore.find({ filter: { serviceId: { $eq: 'svc-1' } }, top: 1 })
        expect(status?.runStatus).toBe('stopped')
        expect(status?.installStatus).toBe('not-installed')
        expect(status?.buildStatus).toBe('not-built')
      }))

    it('should update run status to running', () =>
      usingAsync(new Injector(), async (injector) => {
        const { serviceDefStore, serviceStatusStore } = setupStoreInjector(injector)

        await serviceDefStore.add(createTestServiceDefinition())
        const status = createTestServiceStatus()
        await serviceStatusStore.add(status)

        await serviceStatusStore.update('svc-1', {
          ...status,
          runStatus: 'running',
          lastStartedAt: new Date().toISOString(),
        })
        const [updated] = await serviceStatusStore.find({ filter: { serviceId: { $eq: 'svc-1' } }, top: 1 })
        expect(updated?.runStatus).toBe('running')
        expect(updated?.lastStartedAt).toBeDefined()
      }))

    it('should update install status through lifecycle', () =>
      usingAsync(new Injector(), async (injector) => {
        const { serviceDefStore, serviceStatusStore } = setupStoreInjector(injector)

        await serviceDefStore.add(createTestServiceDefinition())
        const status = createTestServiceStatus()
        await serviceStatusStore.add(status)

        await serviceStatusStore.update('svc-1', { ...status, installStatus: 'installing' })
        const [installing] = await serviceStatusStore.find({ filter: { serviceId: { $eq: 'svc-1' } }, top: 1 })
        expect(installing?.installStatus).toBe('installing')

        await serviceStatusStore.update('svc-1', {
          ...status,
          installStatus: 'installed',
          lastInstalledAt: new Date().toISOString(),
        })
        const [installed] = await serviceStatusStore.find({ filter: { serviceId: { $eq: 'svc-1' } }, top: 1 })
        expect(installed?.installStatus).toBe('installed')
        expect(installed?.lastInstalledAt).toBeDefined()
      }))

    it('should update build status through lifecycle', () =>
      usingAsync(new Injector(), async (injector) => {
        const { serviceDefStore, serviceStatusStore } = setupStoreInjector(injector)

        await serviceDefStore.add(createTestServiceDefinition())
        const status = createTestServiceStatus()
        await serviceStatusStore.add(status)

        await serviceStatusStore.update('svc-1', { ...status, buildStatus: 'building' })
        const [building] = await serviceStatusStore.find({ filter: { serviceId: { $eq: 'svc-1' } }, top: 1 })
        expect(building?.buildStatus).toBe('building')

        await serviceStatusStore.update('svc-1', {
          ...status,
          buildStatus: 'built',
          lastBuiltAt: new Date().toISOString(),
        })
        const [built] = await serviceStatusStore.find({ filter: { serviceId: { $eq: 'svc-1' } }, top: 1 })
        expect(built?.buildStatus).toBe('built')
        expect(built?.lastBuiltAt).toBeDefined()
      }))

    it('should handle error and failed statuses', () =>
      usingAsync(new Injector(), async (injector) => {
        const { serviceDefStore, serviceStatusStore } = setupStoreInjector(injector)

        await serviceDefStore.add(createTestServiceDefinition())
        const status = createTestServiceStatus()
        await serviceStatusStore.add(status)

        await serviceStatusStore.update('svc-1', { ...status, runStatus: 'error' })
        const [errored] = await serviceStatusStore.find({ filter: { serviceId: { $eq: 'svc-1' } }, top: 1 })
        expect(errored?.runStatus).toBe('error')

        await serviceStatusStore.update('svc-1', { ...status, installStatus: 'failed' })
        const [failed] = await serviceStatusStore.find({ filter: { serviceId: { $eq: 'svc-1' } }, top: 1 })
        expect(failed?.installStatus).toBe('failed')
      }))
  })

  describe('Store filtering', () => {
    it('should find services by stack name', () =>
      usingAsync(new Injector(), async (injector) => {
        const { serviceDefStore } = setupStoreInjector(injector)

        await serviceDefStore.add(
          createTestServiceDefinition({ id: 'svc-a', stackName: 'stack-a' }),
          createTestServiceDefinition({ id: 'svc-b', stackName: 'stack-b' }),
          createTestServiceDefinition({ id: 'svc-c', stackName: 'stack-a' }),
        )

        const elevated = useSystemIdentityContext({ injector })
        const serviceDs = getRepository(elevated).getDataSetFor(ServiceDefinition, 'id')
        const stackAServices = await serviceDs.find(elevated, { filter: { stackName: { $eq: 'stack-a' } } })
        expect(stackAServices).toHaveLength(2)
        expect(stackAServices.map((s) => s.id).sort()).toEqual(['svc-a', 'svc-c'])
        await elevated[Symbol.asyncDispose]()
      }))

    it('should find a single service by id', () =>
      usingAsync(new Injector(), async (injector) => {
        const { serviceDefStore } = setupStoreInjector(injector)

        await serviceDefStore.add(createTestServiceDefinition())

        const elevated = useSystemIdentityContext({ injector })
        const [svc] = await getRepository(elevated)
          .getDataSetFor(ServiceDefinition, 'id')
          .find(elevated, { filter: { id: { $eq: 'svc-1' } }, top: 1 })
        expect(svc?.displayName).toBe('Test Service')
        await elevated[Symbol.asyncDispose]()
      }))

    it('should return empty for nonexistent service', () =>
      usingAsync(new Injector(), async (injector) => {
        setupStoreInjector(injector)

        const elevated = useSystemIdentityContext({ injector })
        const result = await getRepository(elevated)
          .getDataSetFor(ServiceDefinition, 'id')
          .find(elevated, { filter: { id: { $eq: 'nonexistent' } }, top: 1 })
        expect(result).toHaveLength(0)
        await elevated[Symbol.asyncDispose]()
      }))
  })
})

describe('ProcessManager (facade)', () => {
  it('should delegate startService to ServiceLifecycleManager', () =>
    withPmContext(async ({ injector, pm }) => {
      await seedService(injector, { id: 'long-svc', runCommand: 'sleep 60' })
      await pm.startService('long-svc', testTrigger)
      await new Promise((r) => setTimeout(r, 200))
      await pm.stopService('long-svc', testTrigger)
    }))

  it('should delegate installService to OneShotCommandRunner', () =>
    withPmContext(async ({ injector, pm }) => {
      await pm.installService('svc-1', testTrigger)

      const elevated = useSystemIdentityContext({ injector })
      const [status] = await getRepository(elevated)
        .getDataSetFor(ServiceStatus, 'serviceId')
        .find(elevated, { filter: { serviceId: { $eq: 'svc-1' } }, top: 1 })
      await elevated[Symbol.asyncDispose]()

      expect(status?.installStatus).toBe('installed')
    }))

  it('should delegate buildService to OneShotCommandRunner', () =>
    withPmContext(async ({ injector, pm }) => {
      await pm.buildService('svc-1', testTrigger)

      const elevated = useSystemIdentityContext({ injector })
      const [status] = await getRepository(elevated)
        .getDataSetFor(ServiceStatus, 'serviceId')
        .find(elevated, { filter: { serviceId: { $eq: 'svc-1' } }, top: 1 })
      await elevated[Symbol.asyncDispose]()

      expect(status?.buildStatus).toBe('built')
    }))

  it('should throw for non-existent service via startService', () =>
    withPmContext(async ({ pm }) => {
      await expect(pm.startService('nonexistent', testTrigger)).rejects.toThrow('Service not found')
    }))

  it('should dispose gracefully', () =>
    withPmContext(async ({ injector, pm }) => {
      await seedService(injector, { id: 'dispose-svc', runCommand: 'sleep 60' })
      await pm.startService('dispose-svc', testTrigger)
      await new Promise((r) => setTimeout(r, 200))
      // withPmContext calls pm[Symbol.asyncDispose]() in finally
    }))
})
