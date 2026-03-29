import { addStore, InMemoryStore } from '@furystack/core'
import { Injector } from '@furystack/inject'
import { useLogging, VerboseConsoleLogger } from '@furystack/logging'
import { getRepository } from '@furystack/repository'
import { Prerequisite, ServiceConfig, ServiceDefinition, StackConfig } from 'common'
import { randomBytes } from 'crypto'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

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
    prerequisiteIds: [],
    prerequisiteServiceIds: [],
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

describe('ServiceEnvResolver', () => {
  let injector: Injector
  let svcDefStore: InMemoryStore<ServiceDefinition, 'id'>
  let prereqStore: InMemoryStore<Prerequisite, 'id'>
  let stackConfigStore: InMemoryStore<StackConfig, 'stackName'>
  let svcConfigStore: InMemoryStore<ServiceConfig, 'serviceId'>
  let savedEncKey: string | undefined

  beforeEach(() => {
    savedEncKey = process.env.STACK_CRAFT_ENCRYPTION_KEY
    process.env.STACK_CRAFT_ENCRYPTION_KEY = randomBytes(32).toString('base64')

    injector = new Injector()
    useLogging(injector, VerboseConsoleLogger)

    svcDefStore = new InMemoryStore({ model: ServiceDefinition, primaryKey: 'id' })
    addStore(injector, svcDefStore)
    getRepository(injector).createDataSet(ServiceDefinition, 'id', {})

    prereqStore = new InMemoryStore({ model: Prerequisite, primaryKey: 'id' })
    addStore(injector, prereqStore)
    getRepository(injector).createDataSet(Prerequisite, 'id', {})

    stackConfigStore = new InMemoryStore({ model: StackConfig, primaryKey: 'stackName' })
    addStore(injector, stackConfigStore)
    getRepository(injector).createDataSet(StackConfig, 'stackName', {})

    svcConfigStore = new InMemoryStore({ model: ServiceConfig, primaryKey: 'serviceId' })
    addStore(injector, svcConfigStore)
    getRepository(injector).createDataSet(ServiceConfig, 'serviceId', {})
  })

  afterEach(async () => {
    await injector[Symbol.asyncDispose]()
    if (savedEncKey === undefined) {
      delete process.env.STACK_CRAFT_ENCRYPTION_KEY
    } else {
      process.env.STACK_CRAFT_ENCRYPTION_KEY = savedEncKey
    }
  })

  const getResolver = () => injector.getInstance(ServiceEnvResolver)

  it('should return empty object when service not found', async () => {
    const resolver = getResolver()
    const result = await resolver.resolveServiceEnvVars('nonexistent')
    expect(result).toEqual({})
  })

  it('should return empty object when service has no env-variable prerequisites', async () => {
    await svcDefStore.add(
      makeServiceDefinition({
        id: 'svc-1',
        stackName: 'stack-a',
        prerequisiteIds: ['prereq-node'],
      }),
    )
    await prereqStore.add(
      makePrerequisite({
        id: 'prereq-node',
        stackName: 'stack-a',
        type: 'node',
        config: { minimumVersion: '18.0.0' },
      }),
    )

    const resolver = getResolver()
    const result = await resolver.resolveServiceEnvVars('svc-1')
    expect(result).toEqual({})
  })

  it('should resolve env vars with inherit source from process.env', async () => {
    const varName = 'TEST_INHERIT_ENV_RESOLVER_12345'
    const original = process.env[varName]
    process.env[varName] = 'inherited-value'

    try {
      await svcDefStore.add(
        makeServiceDefinition({
          id: 'svc-2',
          stackName: 'stack-b',
          prerequisiteIds: ['prereq-env-1'],
        }),
      )
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

      const resolver = getResolver()
      const result = await resolver.resolveServiceEnvVars('svc-2')
      expect(result).toEqual({ [varName]: 'inherited-value' })
    } finally {
      if (original === undefined) {
        delete process.env[varName]
      } else {
        process.env[varName] = original
      }
    }
  })

  it('should resolve env vars with custom source (plaintext)', async () => {
    await svcDefStore.add(
      makeServiceDefinition({
        id: 'svc-3',
        stackName: 'stack-c',
        prerequisiteIds: ['prereq-env-2'],
      }),
    )
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

    const resolver = getResolver()
    const result = await resolver.resolveServiceEnvVars('svc-3')
    expect(result).toEqual({ MY_CUSTOM_VAR: 'plain-secret' })
  })

  it('should resolve env vars with custom source (encrypted value)', async () => {
    const crypto = injector.getInstance(CryptoService)
    const encrypted = crypto.encrypt('super-secret')

    await svcDefStore.add(
      makeServiceDefinition({
        id: 'svc-4',
        stackName: 'stack-d',
        prerequisiteIds: ['prereq-env-3'],
      }),
    )
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

    const resolver = getResolver()
    const result = await resolver.resolveServiceEnvVars('svc-4')
    expect(result).toEqual({ MY_ENCRYPTED_VAR: 'super-secret' })
  })

  it('should prefer service-level override over stack-level default', async () => {
    await svcDefStore.add(
      makeServiceDefinition({
        id: 'svc-5',
        stackName: 'stack-e',
        prerequisiteIds: ['prereq-env-4'],
      }),
    )
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

    const resolver = getResolver()
    const result = await resolver.resolveServiceEnvVars('svc-5')
    expect(result).toEqual({ OVERRIDDEN_VAR: 'service-override' })
  })

  it('should not include env var when inherit but process.env is unset', async () => {
    const varName = 'DEFINITELY_UNSET_VAR_ENV_RESOLVER_12345'
    delete process.env[varName]

    await svcDefStore.add(
      makeServiceDefinition({
        id: 'svc-6',
        stackName: 'stack-f',
        prerequisiteIds: ['prereq-env-5'],
      }),
    )
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

    const resolver = getResolver()
    const result = await resolver.resolveServiceEnvVars('svc-6')
    expect(result).toEqual({})
  })
})
