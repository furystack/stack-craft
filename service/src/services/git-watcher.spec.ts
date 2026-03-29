import { addStore, InMemoryStore, useSystemIdentityContext } from '@furystack/core'
import { Injector } from '@furystack/inject'
import { useLogging, VerboseConsoleLogger } from '@furystack/logging'
import { getRepository } from '@furystack/repository'
import { ServiceConfig, ServiceDefinition, ServiceGitStatus, ServiceStatus } from 'common'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { GitService } from './git-service.js'
import { GitWatcher } from './git-watcher.js'

vi.mock('../utils/resolve-service-cwd.js', () => ({
  resolveServiceCwd: vi.fn().mockResolvedValue('/tmp/repo'),
}))

const createMockGitService = () => ({
  getBranches: vi.fn().mockResolvedValue({ local: ['main'], remote: ['origin/main'] }),
  fetch: vi.fn().mockResolvedValue(undefined),
  getCurrentBranch: vi.fn().mockResolvedValue('main'),
  getCommitsBehind: vi.fn().mockResolvedValue(0),
  pull: vi.fn().mockResolvedValue({ updated: false }),
  clone: vi.fn(),
  checkout: vi.fn(),
})

const setupInjector = (mockGit: ReturnType<typeof createMockGitService>) => {
  const injector = new Injector()
  useLogging(injector, VerboseConsoleLogger)

  addStore(injector, new InMemoryStore({ model: ServiceDefinition, primaryKey: 'id' }))
    .addStore(new InMemoryStore({ model: ServiceConfig, primaryKey: 'serviceId' }))
    .addStore(new InMemoryStore({ model: ServiceStatus, primaryKey: 'serviceId' }))
    .addStore(new InMemoryStore({ model: ServiceGitStatus, primaryKey: 'serviceId' }))

  getRepository(injector).createDataSet(ServiceDefinition, 'id', {})
  getRepository(injector).createDataSet(ServiceConfig, 'serviceId', {})
  getRepository(injector).createDataSet(ServiceStatus, 'serviceId', {})
  getRepository(injector).createDataSet(ServiceGitStatus, 'serviceId', {})

  injector.setExplicitInstance(mockGit as unknown as GitService, GitService)

  return injector
}

const seedService = async (injector: Injector, overrides?: Partial<ServiceDefinition>) => {
  const elevated = useSystemIdentityContext({ injector })
  await getRepository(elevated)
    .getDataSetFor(ServiceDefinition, 'id')
    .add(elevated, {
      id: 'svc-1',
      stackName: 'test-stack',
      displayName: 'Test Service',
      runCommand: 'npm start',
      repositoryId: 'repo-1',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      ...overrides,
    } as ServiceDefinition)
  await getRepository(elevated)
    .getDataSetFor(ServiceStatus, 'serviceId')
    .add(elevated, {
      serviceId: overrides?.id ?? 'svc-1',
      updatedAt: new Date().toISOString(),
    } as ServiceStatus)
  await elevated[Symbol.asyncDispose]()
}

describe('GitWatcher', () => {
  let injector: Injector
  let mockGit: ReturnType<typeof createMockGitService>
  let watcher: GitWatcher

  beforeEach(() => {
    vi.useFakeTimers()
    mockGit = createMockGitService()
    injector = setupInjector(mockGit)
  })

  afterEach(async () => {
    vi.useRealTimers()
    await watcher?.[Symbol.asyncDispose]()
    await injector[Symbol.asyncDispose]()
  })

  describe('startWatching', () => {
    it('should not start watching if service has no repositoryId', async () => {
      await seedService(injector, { id: 'no-repo', repositoryId: undefined })
      watcher = injector.getInstance(GitWatcher)

      await watcher.startWatching('no-repo')

      expect(mockGit.getBranches).not.toHaveBeenCalled()
    })

    it('should not start watching twice for the same service', async () => {
      await seedService(injector)
      watcher = injector.getInstance(GitWatcher)

      await watcher.startWatching('svc-1')
      await watcher.startWatching('svc-1')

      expect(mockGit.getBranches).toHaveBeenCalledTimes(1)
    })

    it('should fetch initial branches when starting to watch', async () => {
      await seedService(injector)
      watcher = injector.getInstance(GitWatcher)

      await watcher.startWatching('svc-1')

      expect(mockGit.getBranches).toHaveBeenCalledWith('/tmp/repo')
    })

    it('should tolerate getBranches failure on start', async () => {
      mockGit.getBranches.mockRejectedValueOnce(new Error('not a git repo'))
      await seedService(injector)
      watcher = injector.getInstance(GitWatcher)

      await expect(watcher.startWatching('svc-1')).resolves.not.toThrow()
    })
  })

  describe('stopWatching', () => {
    it('should clear the interval when stopping', async () => {
      await seedService(injector)
      watcher = injector.getInstance(GitWatcher)

      await watcher.startWatching('svc-1')
      watcher.stopWatching('svc-1')

      mockGit.fetch.mockClear()
      vi.advanceTimersByTime(10 * 60 * 1000)

      expect(mockGit.fetch).not.toHaveBeenCalled()
    })

    it('should be a no-op when service is not being watched', () => {
      watcher = injector.getInstance(GitWatcher)
      expect(() => watcher.stopWatching('nonexistent')).not.toThrow()
    })
  })

  describe('Symbol.asyncDispose', () => {
    it('should clear all watchers on dispose', async () => {
      await seedService(injector)
      watcher = injector.getInstance(GitWatcher)

      await watcher.startWatching('svc-1')
      await watcher[Symbol.asyncDispose]()

      mockGit.fetch.mockClear()
      vi.advanceTimersByTime(10 * 60 * 1000)

      expect(mockGit.fetch).not.toHaveBeenCalled()
    })
  })
})
