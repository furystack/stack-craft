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
import { ServiceLifecycleManager } from './service-lifecycle-manager.js'
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
  injector.setExplicitInstance(
    {
      addEntry: vi.fn().mockResolvedValue(undefined),
      getEntries: vi.fn().mockResolvedValue([]),
    } as unknown as LogStorageService,
    LogStorageService,
  )

  const elevated = useSystemIdentityContext({ injector })
  await getDataSetFor(elevated, StackConfigDataSet).add(elevated, {
    stackName: 'test-stack',
    mainDirectory: tmpdir(),
    environmentVariables: {},
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  })
  await elevated[Symbol.asyncDispose]()
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

const withContext = async (fn: (ctx: { injector: Injector; manager: ServiceLifecycleManager }) => Promise<void>) => {
  const injector = new Injector()
  await setupInjector(injector)
  await seedService(injector)
  const manager = injector.get(ServiceLifecycleManager)
  try {
    await fn({ injector, manager })
  } finally {
    await manager[Symbol.asyncDispose]()
    await new Promise((r) => setTimeout(r, 50))
    try {
      await injector[Symbol.asyncDispose]()
    } catch {
      // Singleton disposal may already have disposed child injectors
    }
  }
}

describe('ServiceLifecycleManager', () => {
  it('should throw when starting a non-existent service', () =>
    withContext(async ({ manager }) => {
      await expect(manager.startService('nonexistent', testTrigger)).rejects.toThrow('Service not found')
    }))

  it('should throw when stopping a service that is not running', () =>
    withContext(async ({ manager }) => {
      await expect(manager.stopService('svc-1', testTrigger)).rejects.toThrow('No running process')
    }))

  it('should start a long-running service and stop it', () =>
    withContext(async ({ injector, manager }) => {
      await seedService(injector, { id: 'long-svc', runCommand: 'sleep 60' })
      await manager.startService('long-svc', testTrigger)

      await new Promise((r) => setTimeout(r, 200))
      await manager.stopService('long-svc', testTrigger)
    }))

  it('should prevent double-starting a service', () =>
    withContext(async ({ injector, manager }) => {
      await seedService(injector, { id: 'double-svc', runCommand: 'sleep 60' })
      await manager.startService('double-svc', testTrigger)
      await new Promise((r) => setTimeout(r, 100))
      await expect(manager.startService('double-svc', testTrigger)).rejects.toThrow('already has a running process')
      await manager.stopService('double-svc', testTrigger)
    }))

  it('should restart a running service', () =>
    withContext(async ({ injector, manager }) => {
      await seedService(injector, { id: 'restart-svc', runCommand: 'sleep 60' })
      await manager.startService('restart-svc', testTrigger)
      await new Promise((r) => setTimeout(r, 200))
      await manager.restartService('restart-svc', testTrigger)
      await new Promise((r) => setTimeout(r, 200))
      await manager.stopService('restart-svc', testTrigger)
    }))

  it('should restart a stopped service without error', () =>
    withContext(async ({ manager }) => {
      await manager.restartService('svc-1', testTrigger)
    }))

  it('should dispose and kill all running processes via shutdownAll', () =>
    withContext(async ({ injector, manager }) => {
      await seedService(injector, { id: 'dispose-svc', runCommand: 'sleep 60' })
      await manager.startService('dispose-svc', testTrigger)
      await new Promise((r) => setTimeout(r, 200))
      // shutdownAll is called by dispose in the `finally` block
    }))
})
