import type { Injector } from '@furystack/inject'
import { ServiceConfig, ServiceDefinition, ServiceStatus, StackConfig } from 'common'
import { describe, expect, it, vi } from 'vitest'

import { withTestInjector } from '../test-helpers.js'
import { CryptoService } from '../utils/crypto-service.js'
import { ServiceEnvResolver } from './service-env-resolver.js'
import { ServiceFileManager } from './service-file-manager.js'

import type * as applyServiceFiles from '../utils/apply-service-files.js'
import { legacyRepository as getRepository } from '../utils/legacy-repository.js'
import '../test-shims.js'
vi.mock('../utils/apply-service-files.js', async (importOriginal) => {
  const actual = await importOriginal<typeof applyServiceFiles>()
  return {
    ...actual,
    applyServiceFiles: vi.fn().mockReturnValue(['.env']),
  }
})

const { applyServiceFiles: applyServiceFilesMock } = await import('../utils/apply-service-files.js')
const mockedApply = vi.mocked(applyServiceFilesMock)

const ts = new Date().toISOString()

const setupMocks = (injector: Injector) => {
  const mockEnvResolver = { resolveServiceEnvVars: vi.fn().mockResolvedValue({ DB_HOST: 'localhost' }) }
  injector.setExplicitInstance(mockEnvResolver as unknown as ServiceEnvResolver, ServiceEnvResolver)

  const mockCrypto = {
    decrypt: vi.fn((v: string) => v),
    encrypt: vi.fn((v: string) => v),
    isEncrypted: vi.fn().mockReturnValue(false),
  }
  injector.setExplicitInstance(mockCrypto as unknown as CryptoService, CryptoService)

  return { mockEnvResolver, mockCrypto }
}

const seedData = async (
  elevated: Injector,
  overrides?: { files?: ServiceDefinition['files']; localFiles?: ServiceConfig['localFiles'] },
) => {
  const repo = getRepository(elevated)
  await repo.getDataSetFor(StackConfig, 'stackName').add(elevated, {
    stackName: 'test-stack',
    mainDirectory: '/tmp/stacks/test',
    environmentVariables: {},
    createdAt: ts,
    updatedAt: ts,
  })
  await repo.getDataSetFor(ServiceDefinition, 'id').add(elevated, {
    id: 'svc-1',
    stackName: 'test-stack',
    displayName: 'Test Service',
    runCommand: 'npm start',
    files: overrides?.files ?? [{ relativePath: '.env', content: 'KEY=val' }],
    createdAt: ts,
    updatedAt: ts,
  } as ServiceDefinition)
  await repo.getDataSetFor(ServiceConfig, 'serviceId').add(elevated, {
    serviceId: 'svc-1',
    autoFetchEnabled: false,
    autoFetchIntervalMinutes: 60,
    autoRestartOnFetch: false,
    environmentVariableOverrides: {},
    localFiles: overrides?.localFiles ?? [],
    createdAt: ts,
    updatedAt: ts,
  })
  await repo.getDataSetFor(ServiceStatus, 'serviceId').add(elevated, {
    serviceId: 'svc-1',
    cloneStatus: 'not-cloned',
    installStatus: 'not-installed',
    buildStatus: 'not-built',
    runStatus: 'stopped',
    updatedAt: ts,
  })
}

describe('ServiceFileManager', () => {
  it('should apply service files and return written paths', () =>
    withTestInjector(async ({ injector, elevated }) => {
      setupMocks(injector)
      await seedData(elevated)

      const manager = injector.get(ServiceFileManager)
      const result = await manager.applyFiles('svc-1')

      expect(mockedApply).toHaveBeenCalledWith(expect.any(String), expect.any(Array), undefined, {
        DB_HOST: 'localhost',
      })
      expect(result).toEqual(['.env'])
    }))

  it('should apply a single file when relativePath is given', () =>
    withTestInjector(async ({ injector, elevated }) => {
      setupMocks(injector)
      await seedData(elevated, { files: [{ relativePath: '.env', content: 'A=1' }] })

      const manager = injector.get(ServiceFileManager)
      await manager.applyFiles('svc-1', '.env')

      expect(mockedApply).toHaveBeenCalledWith(expect.any(String), expect.any(Array), '.env', expect.any(Object))
    }))

  it('should throw NotFoundError when relativePath does not match any file', () =>
    withTestInjector(async ({ injector, elevated }) => {
      setupMocks(injector)
      await seedData(elevated, { files: [{ relativePath: '.env', content: 'A=1' }] })

      const manager = injector.get(ServiceFileManager)
      await expect(manager.applyFiles('svc-1', 'nonexistent.txt')).rejects.toThrow('File not found')
    }))

  it('should throw when service does not exist', () =>
    withTestInjector(async ({ injector }) => {
      setupMocks(injector)

      const manager = injector.get(ServiceFileManager)
      await expect(manager.applyFiles('nonexistent')).rejects.toThrow('Service not found')
    }))
})
