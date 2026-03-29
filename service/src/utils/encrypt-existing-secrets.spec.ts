import type { Injector } from '@furystack/inject'
import { getRepository } from '@furystack/repository'
import { ServiceConfig, StackConfig } from 'common'
import { randomBytes } from 'crypto'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { withTestInjector } from '../test-helpers.js'
import { CryptoService } from './crypto-service.js'
import { encryptExistingSecrets } from './encrypt-existing-secrets.js'

const ts = new Date().toISOString()

describe('encryptExistingSecrets', () => {
  let savedEncKey: string | undefined

  beforeEach(() => {
    savedEncKey = process.env.STACK_CRAFT_ENCRYPTION_KEY
    process.env.STACK_CRAFT_ENCRYPTION_KEY = randomBytes(32).toString('base64')
  })

  afterEach(() => {
    if (savedEncKey === undefined) {
      delete process.env.STACK_CRAFT_ENCRYPTION_KEY
    } else {
      process.env.STACK_CRAFT_ENCRYPTION_KEY = savedEncKey
    }
  })

  const addStackConfig = async (
    elevated: Injector,
    stackName: string,
    environmentVariables: StackConfig['environmentVariables'],
  ) => {
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
    elevated: Injector,
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

  const getStackEnvVars = async (elevated: Injector, stackName: string) => {
    const [config] = await getRepository(elevated)
      .getDataSetFor(StackConfig, 'stackName')
      .find(elevated, { filter: { stackName: { $eq: stackName } } })
    return config.environmentVariables
  }

  const getServiceEnvOverrides = async (elevated: Injector, serviceId: string) => {
    const [config] = await getRepository(elevated)
      .getDataSetFor(ServiceConfig, 'serviceId')
      .find(elevated, { filter: { serviceId: { $eq: serviceId } } })
    return config.environmentVariableOverrides
  }

  it('should encrypt unencrypted sensitive custom values in stack configs', () =>
    withTestInjector(async ({ injector, elevated }) => {
      const crypto = injector.getInstance(CryptoService)
      await addStackConfig(elevated, 'stack-a', {
        SECRET: { source: 'custom', customValue: 'plain-secret', isSensitive: true },
      })

      await encryptExistingSecrets(elevated)

      const vars = await getStackEnvVars(elevated, 'stack-a')
      expect(crypto.isEncrypted(vars.SECRET.customValue!)).toBe(true)
      expect(crypto.decrypt(vars.SECRET.customValue!)).toBe('plain-secret')
    }))

  it('should encrypt unencrypted sensitive custom values in service configs', () =>
    withTestInjector(async ({ injector, elevated }) => {
      const crypto = injector.getInstance(CryptoService)
      await addServiceConfig(elevated, 'svc-1', {
        DB_PASSWORD: { source: 'custom', customValue: 'my-db-password', isSensitive: true },
      })

      await encryptExistingSecrets(elevated)

      const overrides = await getServiceEnvOverrides(elevated, 'svc-1')
      expect(crypto.isEncrypted(overrides.DB_PASSWORD.customValue!)).toBe(true)
      expect(crypto.decrypt(overrides.DB_PASSWORD.customValue!)).toBe('my-db-password')
    }))

  it('should skip already-encrypted values', () =>
    withTestInjector(async ({ injector, elevated }) => {
      const crypto = injector.getInstance(CryptoService)
      const encrypted = crypto.encrypt('already-done')
      await addStackConfig(elevated, 'stack-b', {
        SECRET: { source: 'custom', customValue: encrypted, isSensitive: true },
      })

      await encryptExistingSecrets(elevated)

      const vars = await getStackEnvVars(elevated, 'stack-b')
      expect(vars.SECRET.customValue).toBe(encrypted)
    }))

  it('should not modify non-sensitive values', () =>
    withTestInjector(async ({ elevated }) => {
      await addStackConfig(elevated, 'stack-c', {
        PUBLIC_VAR: { source: 'custom', customValue: 'visible-value' },
      })

      await encryptExistingSecrets(elevated)

      const vars = await getStackEnvVars(elevated, 'stack-c')
      expect(vars.PUBLIC_VAR.customValue).toBe('visible-value')
    }))

  it('should not modify inherit-source values even when sensitive', () =>
    withTestInjector(async ({ elevated }) => {
      await addStackConfig(elevated, 'stack-d', {
        INHERIT_VAR: { source: 'inherit', isSensitive: true },
      })

      await encryptExistingSecrets(elevated)

      const vars = await getStackEnvVars(elevated, 'stack-d')
      expect(vars.INHERIT_VAR).toEqual({ source: 'inherit', isSensitive: true })
    }))

  it('should do nothing when no configs exist', () =>
    withTestInjector(async ({ elevated }) => {
      await expect(encryptExistingSecrets(elevated)).resolves.toBeUndefined()
    }))

  it('should handle configs with empty environment variables', () =>
    withTestInjector(async ({ elevated }) => {
      await addStackConfig(elevated, 'stack-e', {})

      await encryptExistingSecrets(elevated)

      const vars = await getStackEnvVars(elevated, 'stack-e')
      expect(vars).toEqual({})
    }))

  it('should encrypt only the sensitive values in a mixed record', () =>
    withTestInjector(async ({ injector, elevated }) => {
      const crypto = injector.getInstance(CryptoService)
      await addStackConfig(elevated, 'stack-f', {
        SECRET: { source: 'custom', customValue: 'should-encrypt', isSensitive: true },
        PUBLIC: { source: 'custom', customValue: 'should-stay' },
        INHERITED: { source: 'inherit' },
      })

      await encryptExistingSecrets(elevated)

      const vars = await getStackEnvVars(elevated, 'stack-f')
      expect(crypto.isEncrypted(vars.SECRET.customValue!)).toBe(true)
      expect(crypto.decrypt(vars.SECRET.customValue!)).toBe('should-encrypt')
      expect(vars.PUBLIC.customValue).toBe('should-stay')
      expect(vars.INHERITED).toEqual({ source: 'inherit' })
    }))

  it('should be safe to run repeatedly (idempotent)', () =>
    withTestInjector(async ({ injector, elevated }) => {
      const crypto = injector.getInstance(CryptoService)
      await addStackConfig(elevated, 'stack-g', {
        SECRET: { source: 'custom', customValue: 'run-twice', isSensitive: true },
      })

      await encryptExistingSecrets(elevated)
      const afterFirst = await getStackEnvVars(elevated, 'stack-g')
      const firstEncrypted = afterFirst.SECRET.customValue!

      await encryptExistingSecrets(elevated)
      const afterSecond = await getStackEnvVars(elevated, 'stack-g')

      expect(afterSecond.SECRET.customValue).toBe(firstEncrypted)
      expect(crypto.decrypt(afterSecond.SECRET.customValue!)).toBe('run-twice')
    }))

  it('should encrypt across both stack and service configs in a single call', () =>
    withTestInjector(async ({ injector, elevated }) => {
      const crypto = injector.getInstance(CryptoService)
      await addStackConfig(elevated, 'stack-h', {
        STACK_SECRET: { source: 'custom', customValue: 'stack-val', isSensitive: true },
      })
      await addServiceConfig(elevated, 'svc-2', {
        SVC_SECRET: { source: 'custom', customValue: 'svc-val', isSensitive: true },
      })

      await encryptExistingSecrets(elevated)

      const stackVars = await getStackEnvVars(elevated, 'stack-h')
      const svcOverrides = await getServiceEnvOverrides(elevated, 'svc-2')
      expect(crypto.isEncrypted(stackVars.STACK_SECRET.customValue!)).toBe(true)
      expect(crypto.isEncrypted(svcOverrides.SVC_SECRET.customValue!)).toBe(true)
      expect(crypto.decrypt(stackVars.STACK_SECRET.customValue!)).toBe('stack-val')
      expect(crypto.decrypt(svcOverrides.SVC_SECRET.customValue!)).toBe('svc-val')
    }))
})
