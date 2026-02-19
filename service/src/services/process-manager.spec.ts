import { addStore, InMemoryStore, useSystemIdentityContext } from '@furystack/core'
import { Injector } from '@furystack/inject'
import { useLogging, VerboseConsoleLogger } from '@furystack/logging'
import { getRepository } from '@furystack/repository'
import { Service } from 'common'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

describe('ProcessManager - Store Operations', () => {
  let injector: Injector
  let serviceStore: InMemoryStore<Service, 'id'>

  const createTestService = (overrides: Partial<Service> = {}): Service => ({
    id: 'svc-1',
    stackName: 'test-stack',
    displayName: 'Test Service',
    description: '',
    workingDirectory: 'frontends/public',
    runCommand: 'echo hello',
    installCommand: 'echo install',
    buildCommand: 'echo build',
    installStatus: 'not-installed',
    buildStatus: 'not-built',
    runStatus: 'stopped',
    autoFetchEnabled: false,
    autoFetchIntervalMinutes: 60,
    autoRestartOnFetch: false,
    dependencyIds: [],
    prerequisiteServiceIds: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  })

  beforeEach(() => {
    injector = new Injector()
    useLogging(injector, VerboseConsoleLogger)
    serviceStore = new InMemoryStore({ model: Service, primaryKey: 'id' })
    addStore(injector, serviceStore)
    getRepository(injector).createDataSet(Service, 'id', {})
  })

  afterEach(async () => {
    await injector[Symbol.asyncDispose]()
  })

  describe('Service status transitions', () => {
    it('should store a service with initial stopped status', async () => {
      await serviceStore.add(createTestService())

      const [svc] = await serviceStore.find({ filter: { id: { $eq: 'svc-1' } }, top: 1 })
      expect(svc).toBeDefined()
      expect(svc?.runStatus).toBe('stopped')
      expect(svc?.installStatus).toBe('not-installed')
      expect(svc?.buildStatus).toBe('not-built')
    })

    it('should update run status to running', async () => {
      const svc = createTestService()
      await serviceStore.add(svc)

      await serviceStore.update('svc-1', { ...svc, runStatus: 'running', lastStartedAt: new Date().toISOString() })
      const [updated] = await serviceStore.find({ filter: { id: { $eq: 'svc-1' } }, top: 1 })
      expect(updated?.runStatus).toBe('running')
      expect(updated?.lastStartedAt).toBeDefined()
    })

    it('should update install status through lifecycle', async () => {
      const svc = createTestService()
      await serviceStore.add(svc)

      await serviceStore.update('svc-1', { ...svc, installStatus: 'installing' })
      const [installing] = await serviceStore.find({ filter: { id: { $eq: 'svc-1' } }, top: 1 })
      expect(installing?.installStatus).toBe('installing')

      await serviceStore.update('svc-1', {
        ...svc,
        installStatus: 'installed',
        lastInstalledAt: new Date().toISOString(),
      })
      const [installed] = await serviceStore.find({ filter: { id: { $eq: 'svc-1' } }, top: 1 })
      expect(installed?.installStatus).toBe('installed')
      expect(installed?.lastInstalledAt).toBeDefined()
    })

    it('should update build status through lifecycle', async () => {
      const svc = createTestService()
      await serviceStore.add(svc)

      await serviceStore.update('svc-1', { ...svc, buildStatus: 'building' })
      const [building] = await serviceStore.find({ filter: { id: { $eq: 'svc-1' } }, top: 1 })
      expect(building?.buildStatus).toBe('building')

      await serviceStore.update('svc-1', {
        ...svc,
        buildStatus: 'built',
        lastBuiltAt: new Date().toISOString(),
      })
      const [built] = await serviceStore.find({ filter: { id: { $eq: 'svc-1' } }, top: 1 })
      expect(built?.buildStatus).toBe('built')
      expect(built?.lastBuiltAt).toBeDefined()
    })

    it('should handle error and failed statuses', async () => {
      const svc = createTestService()
      await serviceStore.add(svc)

      await serviceStore.update('svc-1', { ...svc, runStatus: 'error' })
      const [errored] = await serviceStore.find({ filter: { id: { $eq: 'svc-1' } }, top: 1 })
      expect(errored?.runStatus).toBe('error')

      await serviceStore.update('svc-1', { ...svc, installStatus: 'failed' })
      const [failed] = await serviceStore.find({ filter: { id: { $eq: 'svc-1' } }, top: 1 })
      expect(failed?.installStatus).toBe('failed')
    })
  })

  describe('Store filtering', () => {
    it('should find services by stack name', async () => {
      await serviceStore.add(
        createTestService({ id: 'svc-a', stackName: 'stack-a' }),
        createTestService({ id: 'svc-b', stackName: 'stack-b' }),
        createTestService({ id: 'svc-c', stackName: 'stack-a' }),
      )

      const elevated = useSystemIdentityContext({ injector })
      const serviceDs = getRepository(elevated).getDataSetFor(Service, 'id')
      const stackAServices = await serviceDs.find(elevated, { filter: { stackName: { $eq: 'stack-a' } } })
      expect(stackAServices).toHaveLength(2)
      expect(stackAServices.map((s) => s.id).sort()).toEqual(['svc-a', 'svc-c'])
      await elevated[Symbol.asyncDispose]()
    })

    it('should find a single service by id', async () => {
      await serviceStore.add(createTestService())

      const elevated = useSystemIdentityContext({ injector })
      const [svc] = await getRepository(elevated).getDataSetFor(Service, 'id').find(elevated, { filter: { id: { $eq: 'svc-1' } }, top: 1 })
      expect(svc?.displayName).toBe('Test Service')
      await elevated[Symbol.asyncDispose]()
    })

    it('should return empty for nonexistent service', async () => {
      const elevated = useSystemIdentityContext({ injector })
      const result = await getRepository(elevated).getDataSetFor(Service, 'id').find(elevated, { filter: { id: { $eq: 'nonexistent' } }, top: 1 })
      expect(result).toHaveLength(0)
      await elevated[Symbol.asyncDispose]()
    })
  })
})
