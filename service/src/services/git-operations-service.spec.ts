import type { Injector } from '@furystack/inject'
import { getRepository } from '@furystack/repository'
import { GitHubRepository, ServiceConfig, ServiceDefinition, ServiceStatus, StackConfig } from 'common'
import type fs from 'fs'
import { describe, expect, it, vi } from 'vitest'
import { withTestInjector } from '../test-helpers.js'
import { CryptoService } from '../utils/crypto-service.js'
import { GitHeadWatcher } from './git-head-watcher.js'
import { GitOperationsService } from './git-operations-service.js'
import { GitService } from './git-service.js'
import { GitWatcher } from './git-watcher.js'
import type { TriggerContext } from './process-manager.js'
import { ServiceEnvResolver } from './service-env-resolver.js'
import { ServiceStatusManager } from './service-status-manager.js'

vi.mock('fs', async (importOriginal) => {
  const actual: typeof fs = await importOriginal()
  return {
    ...actual,
    existsSync: vi.fn().mockReturnValue(false),
    mkdirSync: vi.fn(),
    readdirSync: vi.fn().mockReturnValue([]),
    renameSync: vi.fn(),
  }
})

const { existsSync, readdirSync } = await import('fs')
const existsSyncMock = vi.mocked(existsSync)
const readdirSyncMock = vi.mocked(readdirSync)

const ts = new Date().toISOString()

const setupMocks = (injector: Injector) => {
  const mockStatusManager = { updateServiceStatus: vi.fn().mockResolvedValue(undefined) }
  injector.setExplicitInstance(mockStatusManager as unknown as ServiceStatusManager, ServiceStatusManager)

  const mockGitHeadWatcher = { watch: vi.fn().mockResolvedValue(undefined) }
  injector.setExplicitInstance(mockGitHeadWatcher as unknown as GitHeadWatcher, GitHeadWatcher)

  const mockGitWatcher = { startWatching: vi.fn().mockResolvedValue(undefined) }
  injector.setExplicitInstance(mockGitWatcher as unknown as GitWatcher, GitWatcher)

  const mockGitService = {
    clone: vi.fn().mockResolvedValue(undefined),
    pull: vi.fn().mockResolvedValue({ updated: false }),
  }
  injector.setExplicitInstance(mockGitService as unknown as GitService, GitService)

  const mockEnvResolver = { resolveServiceEnvVars: vi.fn().mockResolvedValue({}) }
  injector.setExplicitInstance(mockEnvResolver as unknown as ServiceEnvResolver, ServiceEnvResolver)

  const mockCrypto = { decrypt: vi.fn((v: string) => v), encrypt: vi.fn((v: string) => v) }
  injector.setExplicitInstance(mockCrypto as unknown as CryptoService, CryptoService)

  return { mockStatusManager, mockGitHeadWatcher, mockGitWatcher, mockGitService, mockEnvResolver }
}

const seedServiceData = async (
  elevated: Injector,
  overrides?: { repositoryId?: string; files?: ServiceDefinition['files'] },
) => {
  const repo = getRepository(elevated)
  await repo.getDataSetFor(StackConfig, 'stackName').add(elevated, {
    stackName: 'test-stack',
    mainDirectory: '/tmp/stacks/test',
    environmentVariables: {},
    createdAt: ts,
    updatedAt: ts,
  } as StackConfig)
  await repo.getDataSetFor(ServiceDefinition, 'id').add(elevated, {
    id: 'svc-1',
    stackName: 'test-stack',
    displayName: 'Test Service',
    runCommand: 'npm start',
    repositoryId: overrides?.repositoryId ?? 'repo-1',
    files: overrides?.files ?? [],
    createdAt: ts,
    updatedAt: ts,
  } as ServiceDefinition)
  await repo.getDataSetFor(ServiceConfig, 'serviceId').add(elevated, {
    serviceId: 'svc-1',
    autoFetchEnabled: false,
    autoFetchIntervalMinutes: 60,
    autoRestartOnFetch: false,
    environmentVariableOverrides: {},
    localFiles: [],
    createdAt: ts,
    updatedAt: ts,
  } as ServiceConfig)
  await repo.getDataSetFor(ServiceStatus, 'serviceId').add(elevated, {
    serviceId: 'svc-1',
    cloneStatus: 'not-cloned',
    installStatus: 'not-installed',
    buildStatus: 'not-built',
    runStatus: 'stopped',
    updatedAt: ts,
  } as ServiceStatus)
  await repo.getDataSetFor(GitHubRepository, 'id').add(elevated, {
    id: 'repo-1',
    stackName: 'test-stack',
    url: 'https://github.com/furystack/stack-craft.git',
    displayName: 'StackCraft',
    description: '',
    createdAt: ts,
    updatedAt: ts,
  } as GitHubRepository)
}

const trigger: TriggerContext = { triggeredBy: 'test-user', triggerSource: 'api' }

describe('GitOperationsService', () => {
  describe('cloneOrPullService', () => {
    it('should clone when the directory does not exist', () =>
      withTestInjector(async ({ injector, elevated }) => {
        const { mockStatusManager, mockGitService, mockGitHeadWatcher, mockGitWatcher } = setupMocks(injector)
        await seedServiceData(elevated)

        existsSyncMock.mockReturnValue(false)

        const service = injector.getInstance(GitOperationsService)
        const result = await service.cloneOrPullService('svc-1', trigger)

        expect(result).toEqual({ cloned: true, pulled: false, updated: true })
        expect(mockGitService.clone).toHaveBeenCalledWith(
          'https://github.com/furystack/stack-craft.git',
          expect.stringContaining('/tmp/stacks/test'),
        )
        expect(mockStatusManager.updateServiceStatus).toHaveBeenCalledWith(
          'svc-1',
          { cloneStatus: 'cloning' },
          'clone-started',
          trigger,
        )
        expect(mockStatusManager.updateServiceStatus).toHaveBeenCalledWith(
          'svc-1',
          { cloneStatus: 'cloned' },
          'clone-completed',
          trigger,
        )
        expect(mockGitHeadWatcher.watch).toHaveBeenCalled()
        expect(mockGitWatcher.startWatching).toHaveBeenCalledWith('svc-1')
      }))

    it('should pull when the directory is an existing git repo', () =>
      withTestInjector(async ({ injector, elevated }) => {
        const { mockGitService } = setupMocks(injector)
        await seedServiceData(elevated)

        existsSyncMock.mockReturnValue(true)
        mockGitService.pull.mockResolvedValueOnce({ updated: true })

        const service = injector.getInstance(GitOperationsService)
        const result = await service.cloneOrPullService('svc-1', trigger)

        expect(result).toEqual({ cloned: false, pulled: true, updated: true })
        expect(mockGitService.pull).toHaveBeenCalled()
        expect(mockGitService.clone).not.toHaveBeenCalled()
      }))

    it('should backup and re-clone when the directory exists but is not a git repo', () =>
      withTestInjector(async ({ injector, elevated }) => {
        const { mockGitService } = setupMocks(injector)
        await seedServiceData(elevated)

        let callCount = 0
        existsSyncMock.mockImplementation(() => {
          callCount++
          // First call: existsSync(cwd) -> true, second: existsSync(join(cwd, '.git')) -> false
          return callCount % 2 === 1
        })
        readdirSyncMock.mockReturnValue(['some-file.txt'] as unknown as ReturnType<typeof readdirSync>)

        const service = injector.getInstance(GitOperationsService)
        const result = await service.cloneOrPullService('svc-1', trigger)

        expect(result).toEqual({ cloned: true, pulled: false, updated: true })
        expect(mockGitService.clone).toHaveBeenCalled()
      }))

    it('should throw when no repository is linked', () =>
      withTestInjector(async ({ injector, elevated }) => {
        setupMocks(injector)
        await seedServiceData(elevated, { repositoryId: undefined })

        // Remove the seeded repo link by re-adding service without repositoryId
        const repo = getRepository(elevated)
        await repo.getDataSetFor(ServiceDefinition, 'id').remove(elevated, 'svc-1')
        await repo.getDataSetFor(ServiceDefinition, 'id').add(elevated, {
          id: 'svc-1',
          stackName: 'test-stack',
          displayName: 'Test Service',
          description: '',
          runCommand: 'npm start',
          files: [],
          createdAt: ts,
          updatedAt: ts,
        } as ServiceDefinition)

        const service = injector.getInstance(GitOperationsService)
        await expect(service.cloneOrPullService('svc-1', trigger)).rejects.toThrow('No repository linked')
      }))

    it('should throw and set status to failed when clone fails', () =>
      withTestInjector(async ({ injector, elevated }) => {
        const { mockStatusManager, mockGitService } = setupMocks(injector)
        await seedServiceData(elevated)

        existsSyncMock.mockReturnValue(false)
        mockGitService.clone.mockRejectedValueOnce(new Error('Network error'))

        const service = injector.getInstance(GitOperationsService)
        await expect(service.cloneOrPullService('svc-1', trigger)).rejects.toThrow('Network error')

        expect(mockStatusManager.updateServiceStatus).toHaveBeenCalledWith(
          'svc-1',
          { cloneStatus: 'failed' },
          'clone-failed',
          trigger,
          { error: 'Network error' },
        )
      }))

    it('should throw when service does not exist', () =>
      withTestInjector(async ({ injector }) => {
        setupMocks(injector)

        const service = injector.getInstance(GitOperationsService)
        await expect(service.cloneOrPullService('nonexistent', trigger)).rejects.toThrow('Service not found')
      }))
  })
})
