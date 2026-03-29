import { getRepository } from '@furystack/repository'
import { ServiceConfig, StackConfig } from 'common'
import { randomBytes } from 'crypto'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { createTestInjector } from '../test-helpers.js'
import { CryptoService } from './crypto-service.js'
import { encryptExistingSecrets } from './encrypt-existing-secrets.js'

const ts = new Date().toISOString()

describe('encryptExistingSecrets', () => {
  let injector: ReturnType<typeof createTestInjector>['injector']
  let elevated: ReturnType<typeof createTestInjector>['elevated']
  let crypto: CryptoService
  let savedEncKey: string | undefined

  beforeEach(() => {
    savedEncKey = process.env.STACK_CRAFT_ENCRYPTION_KEY
    process.env.STACK_CRAFT_ENCRYPTION_KEY = randomBytes(32).toString('base64')
    ;({ injector, elevated } = createTestInjector())
    crypto = injector.getInstance(CryptoService)
  })

  afterEach(async () => {
    await injector[Symbol.asyncDispose]()
    if (savedEncKey === undefined) {
      delete process.env.STACK_CRAFT_ENCRYPTION_KEY
    } else {
      process.env.STACK_CRAFT_ENCRYPTION_KEY = savedEncKey
    }
  })

  const addStackConfig = async (stackName: string, environmentVariables: StackConfig['environmentVariables']) => {
    await getRepository(elevated)
      .getDataSetFor(StackConfig, 'stackName')
      .add(elevated, {
        stackName,
        mainDirectory: '/tmp',
        environmentVariables,
        createdAt: ts,
        updatedAt: ts,
      } as StackConfig)
  }

  const addServiceConfig = async (
    serviceId: string,
    environmentVariableOverrides: ServiceConfig['environmentVariableOverrides'],
  ) => {
    await getRepository(elevated)
      .getDataSetFor(ServiceConfig, 'serviceId')
      .add(elevated, {
        serviceId,
        autoFetchEnabled: false,
        autoFetchIntervalMinutes: 60,
        autoRestartOnFetch: false,
        environmentVariableOverrides,
        localFiles: [],
        createdAt: ts,
        updatedAt: ts,
      } as ServiceConfig)
  }

  const getStackEnvVars = async (stackName: string) => {
    const [config] = await getRepository(elevated)
      .getDataSetFor(StackConfig, 'stackName')
      .find(elevated, { filter: { stackName: { $eq: stackName } } })
    return config.environmentVariables
  }

  const getServiceEnvOverrides = async (serviceId: string) => {
    const [config] = await getRepository(elevated)
      .getDataSetFor(ServiceConfig, 'serviceId')
      .find(elevated, { filter: { serviceId: { $eq: serviceId } } })
    return config.environmentVariableOverrides
  }

  it('should encrypt unencrypted sensitive custom values in stack configs', async () => {
    await addStackConfig('stack-a', {
      SECRET: { source: 'custom', customValue: 'plain-secret', isSensitive: true },
    })

    await encryptExistingSecrets(elevated)

    const vars = await getStackEnvVars('stack-a')
    expect(crypto.isEncrypted(vars.SECRET.customValue!)).toBe(true)
    expect(crypto.decrypt(vars.SECRET.customValue!)).toBe('plain-secret')
  })

  it('should encrypt unencrypted sensitive custom values in service configs', async () => {
    await addServiceConfig('svc-1', {
      DB_PASSWORD: { source: 'custom', customValue: 'my-db-password', isSensitive: true },
    })

    await encryptExistingSecrets(elevated)

    const overrides = await getServiceEnvOverrides('svc-1')
    expect(crypto.isEncrypted(overrides.DB_PASSWORD.customValue!)).toBe(true)
    expect(crypto.decrypt(overrides.DB_PASSWORD.customValue!)).toBe('my-db-password')
  })

  it('should skip already-encrypted values', async () => {
    const encrypted = crypto.encrypt('already-done')
    await addStackConfig('stack-b', {
      SECRET: { source: 'custom', customValue: encrypted, isSensitive: true },
    })

    await encryptExistingSecrets(elevated)

    const vars = await getStackEnvVars('stack-b')
    expect(vars.SECRET.customValue).toBe(encrypted)
  })

  it('should not modify non-sensitive values', async () => {
    await addStackConfig('stack-c', {
      PUBLIC_VAR: { source: 'custom', customValue: 'visible-value' },
    })

    await encryptExistingSecrets(elevated)

    const vars = await getStackEnvVars('stack-c')
    expect(vars.PUBLIC_VAR.customValue).toBe('visible-value')
  })

  it('should not modify inherit-source values even when sensitive', async () => {
    await addStackConfig('stack-d', {
      INHERIT_VAR: { source: 'inherit', isSensitive: true },
    })

    await encryptExistingSecrets(elevated)

    const vars = await getStackEnvVars('stack-d')
    expect(vars.INHERIT_VAR).toEqual({ source: 'inherit', isSensitive: true })
  })

  it('should do nothing when no configs exist', async () => {
    await expect(encryptExistingSecrets(elevated)).resolves.toBeUndefined()
  })

  it('should handle configs with empty environment variables', async () => {
    await addStackConfig('stack-e', {})

    await encryptExistingSecrets(elevated)

    const vars = await getStackEnvVars('stack-e')
    expect(vars).toEqual({})
  })

  it('should encrypt only the sensitive values in a mixed record', async () => {
    await addStackConfig('stack-f', {
      SECRET: { source: 'custom', customValue: 'should-encrypt', isSensitive: true },
      PUBLIC: { source: 'custom', customValue: 'should-stay' },
      INHERITED: { source: 'inherit' },
    })

    await encryptExistingSecrets(elevated)

    const vars = await getStackEnvVars('stack-f')
    expect(crypto.isEncrypted(vars.SECRET.customValue!)).toBe(true)
    expect(crypto.decrypt(vars.SECRET.customValue!)).toBe('should-encrypt')
    expect(vars.PUBLIC.customValue).toBe('should-stay')
    expect(vars.INHERITED).toEqual({ source: 'inherit' })
  })

  it('should be safe to run repeatedly (idempotent)', async () => {
    await addStackConfig('stack-g', {
      SECRET: { source: 'custom', customValue: 'run-twice', isSensitive: true },
    })

    await encryptExistingSecrets(elevated)
    const afterFirst = await getStackEnvVars('stack-g')
    const firstEncrypted = afterFirst.SECRET.customValue!

    await encryptExistingSecrets(elevated)
    const afterSecond = await getStackEnvVars('stack-g')

    expect(afterSecond.SECRET.customValue).toBe(firstEncrypted)
    expect(crypto.decrypt(afterSecond.SECRET.customValue!)).toBe('run-twice')
  })

  it('should encrypt across both stack and service configs in a single call', async () => {
    await addStackConfig('stack-h', {
      STACK_SECRET: { source: 'custom', customValue: 'stack-val', isSensitive: true },
    })
    await addServiceConfig('svc-2', {
      SVC_SECRET: { source: 'custom', customValue: 'svc-val', isSensitive: true },
    })

    await encryptExistingSecrets(elevated)

    const stackVars = await getStackEnvVars('stack-h')
    const svcOverrides = await getServiceEnvOverrides('svc-2')
    expect(crypto.isEncrypted(stackVars.STACK_SECRET.customValue!)).toBe(true)
    expect(crypto.isEncrypted(svcOverrides.SVC_SECRET.customValue!)).toBe(true)
    expect(crypto.decrypt(stackVars.STACK_SECRET.customValue!)).toBe('stack-val')
    expect(crypto.decrypt(svcOverrides.SVC_SECRET.customValue!)).toBe('svc-val')
  })
})
