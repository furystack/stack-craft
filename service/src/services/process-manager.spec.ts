import { addStore, InMemoryStore, useSystemIdentityContext } from '@furystack/core'
import { Injector } from '@furystack/inject'
import { useLogging, VerboseConsoleLogger } from '@furystack/logging'
import { getRepository } from '@furystack/repository'
import { GitHubRepository, Service, Stack } from 'common'
import { tmpdir } from 'os'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { ProcessManager } from './process-manager.js'
import { WebsocketService } from './websocket-service.js'

const createTestService = (overrides: Partial<Service> = {}): Service => ({
  id: 'svc-1',
  stackName: 'test-stack',
  displayName: 'Test Service',
  description: '',
  workingDirectory: '',
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

describe('ProcessManager - Store Operations', () => {
  let injector: Injector
  let serviceStore: InMemoryStore<Service, 'id'>

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
      const [svc] = await getRepository(elevated)
        .getDataSetFor(Service, 'id')
        .find(elevated, { filter: { id: { $eq: 'svc-1' } }, top: 1 })
      expect(svc?.displayName).toBe('Test Service')
      await elevated[Symbol.asyncDispose]()
    })

    it('should return empty for nonexistent service', async () => {
      const elevated = useSystemIdentityContext({ injector })
      const result = await getRepository(elevated)
        .getDataSetFor(Service, 'id')
        .find(elevated, { filter: { id: { $eq: 'nonexistent' } }, top: 1 })
      expect(result).toHaveLength(0)
      await elevated[Symbol.asyncDispose]()
    })
  })
})

describe('ProcessManager', () => {
  let injector: Injector
  let pm: ProcessManager

  const seedService = async (overrides: Partial<Service> = {}) => {
    const elevated = useSystemIdentityContext({ injector })
    await getRepository(elevated).getDataSetFor(Service, 'id').add(elevated, createTestService(overrides))
    await elevated[Symbol.asyncDispose]()
  }

  beforeEach(async () => {
    injector = new Injector()
    useLogging(injector, VerboseConsoleLogger)

    addStore(injector, new InMemoryStore({ model: Service, primaryKey: 'id' }))
    addStore(injector, new InMemoryStore({ model: Stack, primaryKey: 'name' }))
    addStore(injector, new InMemoryStore({ model: GitHubRepository, primaryKey: 'id' }))

    getRepository(injector).createDataSet(Service, 'id', {})
    getRepository(injector).createDataSet(Stack, 'name', {})
    getRepository(injector).createDataSet(GitHubRepository, 'id', {})

    const mockWs = { announce: vi.fn().mockResolvedValue(undefined) }
    injector.setExplicitInstance(mockWs as unknown as WebsocketService, WebsocketService)

    const elevated = useSystemIdentityContext({ injector })
    await getRepository(elevated).getDataSetFor(Stack, 'name').add(elevated, {
      name: 'test-stack',
      displayName: 'Test Stack',
      description: '',
      mainDirectory: tmpdir(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    })
    await elevated[Symbol.asyncDispose]()

    await seedService()
    pm = injector.getInstance(ProcessManager)
  })

  afterEach(async () => {
    await pm[Symbol.asyncDispose]()
    // Allow pending child process exit handlers to settle before injector disposal
    await new Promise((r) => setTimeout(r, 50))
    try {
      await injector[Symbol.asyncDispose]()
    } catch {
      // PM's singleton disposal may fail since it was already manually disposed
    }
  })

  it('should throw when starting a non-existent service', async () => {
    await expect(pm.startService('nonexistent')).rejects.toThrow('Service not found')
  })

  it('should throw when stopping a service that is not running', async () => {
    await expect(pm.stopService('svc-1')).rejects.toThrow('No running process')
  })

  it('should throw when installCommand is missing', async () => {
    await seedService({ id: 'no-install', installCommand: undefined })
    await expect(pm.installService('no-install')).rejects.toThrow('No install command')
  })

  it('should throw when buildCommand is missing', async () => {
    await seedService({ id: 'no-build', buildCommand: undefined })
    await expect(pm.buildService('no-build')).rejects.toThrow('No build command')
  })

  it('should return empty logs for unknown service', () => {
    expect(pm.getLogLines('unknown')).toEqual([])
  })

  it('should run installService successfully', async () => {
    await pm.installService('svc-1')

    const elevated = useSystemIdentityContext({ injector })
    const [svc] = await getRepository(elevated)
      .getDataSetFor(Service, 'id')
      .find(elevated, { filter: { id: { $eq: 'svc-1' } }, top: 1 })
    await elevated[Symbol.asyncDispose]()

    expect(svc?.installStatus).toBe('installed')
    expect(svc?.lastInstalledAt).toBeDefined()
  })

  it('should run buildService successfully', async () => {
    await pm.buildService('svc-1')

    const elevated = useSystemIdentityContext({ injector })
    const [svc] = await getRepository(elevated)
      .getDataSetFor(Service, 'id')
      .find(elevated, { filter: { id: { $eq: 'svc-1' } }, top: 1 })
    await elevated[Symbol.asyncDispose]()

    expect(svc?.buildStatus).toBe('built')
    expect(svc?.lastBuiltAt).toBeDefined()
  })

  it('should reject when a one-shot command fails', async () => {
    await seedService({ id: 'fail-svc', installCommand: 'exit 1' })
    await expect(pm.installService('fail-svc')).rejects.toThrow('exited with code 1')

    const elevated = useSystemIdentityContext({ injector })
    const [svc] = await getRepository(elevated)
      .getDataSetFor(Service, 'id')
      .find(elevated, { filter: { id: { $eq: 'fail-svc' } }, top: 1 })
    await elevated[Symbol.asyncDispose]()

    expect(svc?.installStatus).toBe('failed')
  })

  it('should start a long-running service and stop it', async () => {
    await seedService({ id: 'long-svc', runCommand: 'sleep 60' })
    await pm.startService('long-svc')

    await new Promise((r) => setTimeout(r, 200))
    await pm.stopService('long-svc')
  })

  it('should prevent double-starting a service', async () => {
    await seedService({ id: 'double-svc', runCommand: 'sleep 60' })
    await pm.startService('double-svc')
    await new Promise((r) => setTimeout(r, 100))
    await expect(pm.startService('double-svc')).rejects.toThrow('already has a running process')
    await pm.stopService('double-svc')
  })

  it('should dispose and kill all running processes', async () => {
    await seedService({ id: 'dispose-svc', runCommand: 'sleep 60' })
    await pm.startService('dispose-svc')
    await new Promise((r) => setTimeout(r, 200))
    // PM disposal will happen in afterEach — verifies no crash when processes are running
  })

  it('should prevent one-shot when a process is already running', async () => {
    await seedService({ id: 'busy-svc', runCommand: 'sleep 60' })
    await pm.startService('busy-svc')
    await new Promise((r) => setTimeout(r, 100))
    await expect(pm.installService('busy-svc')).rejects.toThrow('already has a')
    await pm.stopService('busy-svc')
  })
})
