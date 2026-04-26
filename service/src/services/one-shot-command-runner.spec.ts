import {
  ServiceConfigDataSet,
  ServiceDefinitionDataSet,
  ServiceStatusDataSet,
  StackConfigDataSet,
} from '../app-models/data-store/tokens.js'
import { getDataSetFor } from '@furystack/repository'
import { InMemoryStore, useSystemIdentityContext } from '@furystack/core'
import { addStore } from '../test-shims.js'
import { Injector } from '@furystack/inject'
import { useLogging, VerboseConsoleLogger } from '@furystack/logging'
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

import { GitHeadWatcher } from './git-head-watcher.js'
import { LogStorageService } from './log-storage-service.js'
import { OneShotCommandRunner } from './one-shot-command-runner.js'
import type { TriggerContext } from './trigger-context.js'
import { legacyRepository as getRepository } from '../utils/legacy-repository.js'

const testTrigger: TriggerContext = { triggeredBy: 'test', triggerSource: 'api' }

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

const setupInjector = async (injector: Injector) => {
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

  injector.setExplicitInstance(
    { watch: vi.fn().mockResolvedValue(undefined), unwatch: vi.fn() } as unknown as GitHeadWatcher,
    GitHeadWatcher,
  )
  const mockLogStorage = {
    addEntry: vi.fn().mockResolvedValue(undefined),
    getEntries: vi.fn().mockResolvedValue([]),
  }
  injector.setExplicitInstance(mockLogStorage as unknown as LogStorageService, LogStorageService)

  const elevated = useSystemIdentityContext({ injector })
  await getDataSetFor(elevated, StackConfigDataSet).add(elevated, {
    stackName: 'test-stack',
    mainDirectory: tmpdir(),
    environmentVariables: {},
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  })
  await elevated[Symbol.asyncDispose]()

  return { mockLogStorage }
}

const seedService = async (injector: Injector, overrides: Partial<ServiceDefinition> = {}) => {
  const elevated = useSystemIdentityContext({ injector })
  const svcDef = createTestServiceDefinition(overrides)
  await getDataSetFor(elevated, ServiceDefinitionDataSet).add(elevated, svcDef)
  await getDataSetFor(elevated, ServiceStatusDataSet).add(elevated, createTestServiceStatus({ serviceId: svcDef.id }))
  await getDataSetFor(elevated, ServiceConfigDataSet).add(elevated, {
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

const withContext = async (
  fn: (ctx: {
    injector: Injector
    runner: OneShotCommandRunner
    mockLogStorage: { addEntry: ReturnType<typeof vi.fn> }
  }) => Promise<void>,
) => {
  const injector = new Injector()
  const { mockLogStorage } = await setupInjector(injector)
  await seedService(injector)
  const runner = injector.get(OneShotCommandRunner)
  try {
    await fn({ injector, runner, mockLogStorage })
  } finally {
    await runner[Symbol.asyncDispose]()
    await new Promise((r) => setTimeout(r, 50))
    try {
      await injector[Symbol.asyncDispose]()
    } catch {
      // Singleton disposal may already have disposed child injectors
    }
  }
}

describe('OneShotCommandRunner', () => {
  it('should throw when installCommand is missing', () =>
    withContext(async ({ injector, runner }) => {
      await seedService(injector, { id: 'no-install', installCommand: undefined })
      await expect(runner.installService('no-install', testTrigger)).rejects.toThrow('No install command')
    }))

  it('should throw when buildCommand is missing', () =>
    withContext(async ({ injector, runner }) => {
      await seedService(injector, { id: 'no-build', buildCommand: undefined })
      await expect(runner.buildService('no-build', testTrigger)).rejects.toThrow('No build command')
    }))

  it('should run installService successfully', () =>
    withContext(async ({ injector, runner }) => {
      await runner.installService('svc-1', testTrigger)

      const elevated = useSystemIdentityContext({ injector })
      const [status] = await getDataSetFor(elevated, ServiceStatusDataSet).find(elevated, {
        filter: { serviceId: { $eq: 'svc-1' } },
        top: 1,
      })
      await elevated[Symbol.asyncDispose]()

      expect(status?.installStatus).toBe('installed')
      expect(status?.lastInstalledAt).toBeDefined()
    }))

  it('should run buildService successfully', () =>
    withContext(async ({ injector, runner }) => {
      await runner.buildService('svc-1', testTrigger)

      const elevated = useSystemIdentityContext({ injector })
      const [status] = await getDataSetFor(elevated, ServiceStatusDataSet).find(elevated, {
        filter: { serviceId: { $eq: 'svc-1' } },
        top: 1,
      })
      await elevated[Symbol.asyncDispose]()

      expect(status?.buildStatus).toBe('built')
      expect(status?.lastBuiltAt).toBeDefined()
    }))

  it('should reject when a one-shot command fails', () =>
    withContext(async ({ injector, runner }) => {
      await seedService(injector, { id: 'fail-svc', installCommand: 'exit 1' })
      await expect(runner.installService('fail-svc', testTrigger)).rejects.toThrow('exited with code 1')

      const elevated = useSystemIdentityContext({ injector })
      const [status] = await getDataSetFor(elevated, ServiceStatusDataSet).find(elevated, {
        filter: { serviceId: { $eq: 'fail-svc' } },
        top: 1,
      })
      await elevated[Symbol.asyncDispose]()

      expect(status?.installStatus).toBe('failed')
    }))

  it('should delegate log lines to LogStorageService', () =>
    withContext(async ({ runner, mockLogStorage }) => {
      await runner.installService('svc-1', testTrigger)
      await new Promise((r) => setTimeout(r, 100))
      expect(mockLogStorage.addEntry).toHaveBeenCalled()
    }))

  it('should prevent one-shot when a process is already running', () =>
    withContext(async ({ injector, runner }) => {
      await seedService(injector, { id: 'busy-svc', installCommand: 'sleep 60' })
      const installPromise = runner.installService('busy-svc', testTrigger)

      await new Promise((r) => setTimeout(r, 100))
      await expect(runner.buildService('busy-svc', testTrigger)).rejects.toThrow('already has a')

      // Clean up: the install process is still running, kill it via the process runner
      const { ProcessRunner: PR } = await import('./process-runner.js')
      const processRunner = injector.get(PR)
      const managed = processRunner.processes.get('busy-svc')
      if (managed) processRunner.killProcessGroup(managed.process, 'SIGKILL')
      await installPromise.catch(() => {})
    }))
})
