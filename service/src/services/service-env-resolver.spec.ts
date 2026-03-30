import { addStore, InMemoryStore } from '@furystack/core'
import { Injector } from '@furystack/inject'
import { useLogging, VerboseConsoleLogger } from '@furystack/logging'
import { getRepository } from '@furystack/repository'
import { usingAsync } from '@furystack/utils'
import { Prerequisite, ServiceConfig, ServiceDefinition, ServicePrerequisiteLink, StackConfig } from 'common'
import { randomBytes } from 'crypto'
import { describe, expect, it } from 'vitest'

import { CryptoService } from '../utils/crypto-service.js'
import { ServiceEnvResolver } from './service-env-resolver.js'

const ts = new Date().toISOString()

const makeServiceDefinition = (
  overrides: Partial<ServiceDefinition> & { id: string; stackName: string },
): ServiceDefinition =>
  ({
    displayName: overrides.id,
    description: '',
    runCommand: 'echo test',
    files: [],
    createdAt: ts,
    updatedAt: ts,
    ...overrides,
  }) as ServiceDefinition

const makePrerequisite = (overrides: Partial<Prerequisite> & { id: string; stackName: string }): Prerequisite =>
  ({
    name: overrides.id,
    type: 'env-variable',
    config: { variableName: 'UNSET' },
    installationHelp: '',
    createdAt: ts,
    updatedAt: ts,
    ...overrides,
  }) as Prerequisite

const withEnvAndInjector = async (
  fn: (ctx: {
    injector: Injector
    svcDefStore: InMemoryStore<ServiceDefinition, 'id'>
    prereqStore: InMemoryStore<Prerequisite, 'id'>
    stackConfigStore: InMemoryStore<StackConfig, 'stackName'>
    svcConfigStore: InMemoryStore<ServiceConfig, 'serviceId'>
    prereqLinkStore: InMemoryStore<ServicePrerequisiteLink, 'id'>
  }) => Promise<void>,
) => {
  const savedEncKey = process.env.STACK_CRAFT_ENCRYPTION_KEY
  process.env.STACK_CRAFT_ENCRYPTION_KEY = randomBytes(32).toString('base64')
  try {
    await usingAsync(new Injector(), async (injector) => {
      useLogging(injector, VerboseConsoleLogger)

      const svcDefStore = new InMemoryStore({ model: ServiceDefinition, primaryKey: 'id' })
      addStore(injector, svcDefStore)
      getRepository(injector).createDataSet(ServiceDefinition, 'id', {})

      const prereqStore = new InMemoryStore({ model: Prerequisite, primaryKey: 'id' })
      addStore(injector, prereqStore)
      getRepository(injector).createDataSet(Prerequisite, 'id', {})

      const stackConfigStore = new InMemoryStore({ model: StackConfig, primaryKey: 'stackName' })
      addStore(injector, stackConfigStore)
      getRepository(injector).createDataSet(StackConfig, 'stackName', {})

      const svcConfigStore = new InMemoryStore({ model: ServiceConfig, primaryKey: 'serviceId' })
      addStore(injector, svcConfigStore)
      getRepository(injector).createDataSet(ServiceConfig, 'serviceId', {})

      const prereqLinkStore = new InMemoryStore({ model: ServicePrerequisiteLink, primaryKey: 'id' })
      addStore(injector, prereqLinkStore)
      getRepository(injector).createDataSet(ServicePrerequisiteLink, 'id', {})

      await fn({ injector, svcDefStore, prereqStore, stackConfigStore, svcConfigStore, prereqLinkStore })
    })
  } finally {
    if (savedEncKey === undefined) {
      delete process.env.STACK_CRAFT_ENCRYPTION_KEY
    } else {
      process.env.STACK_CRAFT_ENCRYPTION_KEY = savedEncKey
    }
  }
}

describe('ServiceEnvResolver', () => {
  it('should return empty object when service not found', () =>
    withEnvAndInjector(async ({ injector }) => {
      const resolver = injector.getInstance(ServiceEnvResolver)
      const result = await resolver.resolveServiceEnvVars('nonexistent')
      expect(result).toEqual({})
    }))

  it('should return empty object when service has no env-variable prerequisites', () =>
    withEnvAndInjector(async ({ svcDefStore, prereqStore, prereqLinkStore, injector }) => {
      await svcDefStore.add(
        makeServiceDefinition({
          id: 'svc-1',
          stackName: 'stack-a',
        }),
      )
      await prereqLinkStore.add({ id: 'svc-1::prereq-node', serviceId: 'svc-1', prerequisiteId: 'prereq-node' })
      await prereqStore.add(
        makePrerequisite({
          id: 'prereq-node',
          stackName: 'stack-a',
          type: 'node',
          config: { minimumVersion: '18.0.0' },
        }),
      )

      const resolver = injector.getInstance(ServiceEnvResolver)
      const result = await resolver.resolveServiceEnvVars('svc-1')
      expect(result).toEqual({})
    }))

  it('should resolve env vars with inherit source from process.env', () =>
    withEnvAndInjector(async ({ svcDefStore, prereqStore, stackConfigStore, prereqLinkStore, injector }) => {
      const varName = 'TEST_INHERIT_ENV_RESOLVER_12345'
      const original = process.env[varName]
      process.env[varName] = 'inherited-value'

      try {
        await svcDefStore.add(
          makeServiceDefinition({
            id: 'svc-2',
            stackName: 'stack-b',
          }),
        )
        await prereqLinkStore.add({ id: 'svc-2::prereq-env-1', serviceId: 'svc-2', prerequisiteId: 'prereq-env-1' })
        await prereqStore.add(
          makePrerequisite({
            id: 'prereq-env-1',
            stackName: 'stack-b',
            config: { variableName: varName },
          }),
        )
        await stackConfigStore.add({
          stackName: 'stack-b',
          mainDirectory: '/tmp',
          environmentVariables: {
            [varName]: { source: 'inherit' },
          },
          createdAt: ts,
          updatedAt: ts,
        } as StackConfig)

        const resolver = injector.getInstance(ServiceEnvResolver)
        const result = await resolver.resolveServiceEnvVars('svc-2')
        expect(result).toEqual({ [varName]: 'inherited-value' })
      } finally {
        if (original === undefined) {
          delete process.env[varName]
        } else {
          process.env[varName] = original
        }
      }
    }))

  it('should resolve env vars with custom source (plaintext)', () =>
    withEnvAndInjector(async ({ svcDefStore, prereqStore, stackConfigStore, prereqLinkStore, injector }) => {
      await svcDefStore.add(
        makeServiceDefinition({
          id: 'svc-3',
          stackName: 'stack-c',
        }),
      )
      await prereqLinkStore.add({ id: 'svc-3::prereq-env-2', serviceId: 'svc-3', prerequisiteId: 'prereq-env-2' })
      await prereqStore.add(
        makePrerequisite({
          id: 'prereq-env-2',
          stackName: 'stack-c',
          config: { variableName: 'MY_CUSTOM_VAR' },
        }),
      )
      await stackConfigStore.add({
        stackName: 'stack-c',
        mainDirectory: '/tmp',
        environmentVariables: {
          MY_CUSTOM_VAR: { source: 'custom', customValue: 'plain-secret' },
        },
        createdAt: ts,
        updatedAt: ts,
      } as StackConfig)

      const resolver = injector.getInstance(ServiceEnvResolver)
      const result = await resolver.resolveServiceEnvVars('svc-3')
      expect(result).toEqual({ MY_CUSTOM_VAR: 'plain-secret' })
    }))

  it('should resolve env vars with custom source (encrypted value)', () =>
    withEnvAndInjector(async ({ svcDefStore, prereqStore, stackConfigStore, prereqLinkStore, injector }) => {
      const crypto = injector.getInstance(CryptoService)
      const encrypted = crypto.encrypt('super-secret')

      await svcDefStore.add(
        makeServiceDefinition({
          id: 'svc-4',
          stackName: 'stack-d',
        }),
      )
      await prereqLinkStore.add({ id: 'svc-4::prereq-env-3', serviceId: 'svc-4', prerequisiteId: 'prereq-env-3' })
      await prereqStore.add(
        makePrerequisite({
          id: 'prereq-env-3',
          stackName: 'stack-d',
          config: { variableName: 'MY_ENCRYPTED_VAR' },
        }),
      )
      await stackConfigStore.add({
        stackName: 'stack-d',
        mainDirectory: '/tmp',
        environmentVariables: {
          MY_ENCRYPTED_VAR: { source: 'custom', customValue: encrypted },
        },
        createdAt: ts,
        updatedAt: ts,
      } as StackConfig)

      const resolver = injector.getInstance(ServiceEnvResolver)
      const result = await resolver.resolveServiceEnvVars('svc-4')
      expect(result).toEqual({ MY_ENCRYPTED_VAR: 'super-secret' })
    }))

  it('should prefer service-level override over stack-level default', () =>
    withEnvAndInjector(
      async ({ svcDefStore, prereqStore, stackConfigStore, svcConfigStore, prereqLinkStore, injector }) => {
        await svcDefStore.add(
          makeServiceDefinition({
            id: 'svc-5',
            stackName: 'stack-e',
          }),
        )
        await prereqLinkStore.add({ id: 'svc-5::prereq-env-4', serviceId: 'svc-5', prerequisiteId: 'prereq-env-4' })
        await prereqStore.add(
          makePrerequisite({
            id: 'prereq-env-4',
            stackName: 'stack-e',
            config: { variableName: 'OVERRIDDEN_VAR' },
          }),
        )
        await stackConfigStore.add({
          stackName: 'stack-e',
          mainDirectory: '/tmp',
          environmentVariables: {
            OVERRIDDEN_VAR: { source: 'custom', customValue: 'stack-default' },
          },
          createdAt: ts,
          updatedAt: ts,
        } as StackConfig)
        await svcConfigStore.add({
          serviceId: 'svc-5',
          autoFetchEnabled: false,
          autoFetchIntervalMinutes: 60,
          autoRestartOnFetch: false,
          environmentVariableOverrides: {
            OVERRIDDEN_VAR: { source: 'custom', customValue: 'service-override' },
          },
          localFiles: [],
          createdAt: ts,
          updatedAt: ts,
        } as ServiceConfig)

        const resolver = injector.getInstance(ServiceEnvResolver)
        const result = await resolver.resolveServiceEnvVars('svc-5')
        expect(result).toEqual({ OVERRIDDEN_VAR: 'service-override' })
      },
    ))

  it('should not include env var when inherit but process.env is unset', () =>
    withEnvAndInjector(async ({ svcDefStore, prereqStore, stackConfigStore, prereqLinkStore, injector }) => {
      const varName = 'DEFINITELY_UNSET_VAR_ENV_RESOLVER_12345'
      delete process.env[varName]

      await svcDefStore.add(
        makeServiceDefinition({
          id: 'svc-6',
          stackName: 'stack-f',
        }),
      )
      await prereqLinkStore.add({ id: 'svc-6::prereq-env-5', serviceId: 'svc-6', prerequisiteId: 'prereq-env-5' })
      await prereqStore.add(
        makePrerequisite({
          id: 'prereq-env-5',
          stackName: 'stack-f',
          config: { variableName: varName },
        }),
      )
      await stackConfigStore.add({
        stackName: 'stack-f',
        mainDirectory: '/tmp',
        environmentVariables: {
          [varName]: { source: 'inherit' },
        },
        createdAt: ts,
        updatedAt: ts,
      } as StackConfig)

      const resolver = injector.getInstance(ServiceEnvResolver)
      const result = await resolver.resolveServiceEnvVars('svc-6')
      expect(result).toEqual({})
    }))
})
