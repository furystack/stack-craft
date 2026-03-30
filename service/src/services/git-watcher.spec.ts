import type { Injector } from '@furystack/inject'
import { getRepository } from '@furystack/repository'

import { beforeEach, describe, expect, it, vi } from 'vitest'

import { ServiceDefinition } from 'common'

import { withTestInjector } from '../test-helpers.js'
import { GitService } from './git-service.js'
import { GitWatcher } from './git-watcher.js'

const FETCH_CHECK_INTERVAL_MS = 5 * 60 * 1000

vi.mock('../utils/resolve-service-cwd.js', () => ({
  resolveServiceCwd: vi.fn().mockResolvedValue('/tmp/repo'),
}))

const addServiceDefinition = async (elevated: Injector, overrides: Partial<ServiceDefinition> = {}) => {
  await getRepository(elevated)
    .getDataSetFor(ServiceDefinition, 'id')
    .add(elevated, {
      id: 'svc-1',
      stackName: 'stack',
      displayName: 'Test',
      runCommand: 'npm start',
      repositoryId: 'repo-1',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      ...overrides,
    } as ServiceDefinition)
}

const createMockGit = () => ({
  getBranches: vi.fn().mockResolvedValue({ local: ['main'], remote: ['origin/main'] }),
  fetch: vi.fn().mockResolvedValue(undefined),
  getCurrentBranch: vi.fn().mockResolvedValue('main'),
  getCommitsBehind: vi.fn().mockResolvedValue(0),
  pull: vi.fn().mockResolvedValue({ updated: false }),
})

beforeEach(() => {
  vi.clearAllMocks()
})

describe('GitWatcher', () => {
  it('startWatching() does nothing if service already being watched', () =>
    withTestInjector(async ({ injector, elevated }) => {
      await addServiceDefinition(elevated)
      const mockGit = createMockGit()
      injector.setExplicitInstance(mockGit as unknown as GitService, GitService)
      const watcher = injector.getInstance(GitWatcher)

      try {
        await watcher.startWatching('svc-1')
        await watcher.startWatching('svc-1')
        expect(mockGit.getBranches).toHaveBeenCalledTimes(1)
      } finally {
        await watcher[Symbol.asyncDispose]()
      }
    }))

  it('startWatching() does nothing if service has no repositoryId', () =>
    withTestInjector(async ({ injector, elevated }) => {
      await addServiceDefinition(elevated, { id: 'no-repo', repositoryId: undefined })
      const mockGit = createMockGit()
      injector.setExplicitInstance(mockGit as unknown as GitService, GitService)
      const watcher = injector.getInstance(GitWatcher)

      await watcher.startWatching('no-repo')

      expect(mockGit.getBranches).not.toHaveBeenCalled()
    }))

  it('startWatching() creates a watcher entry with interval timer', () =>
    withTestInjector(async ({ injector, elevated }) => {
      await addServiceDefinition(elevated)
      const mockGit = createMockGit()
      injector.setExplicitInstance(mockGit as unknown as GitService, GitService)
      const watcher = injector.getInstance(GitWatcher)
      const setIntervalSpy = vi.spyOn(globalThis, 'setInterval')

      try {
        await watcher.startWatching('svc-1')
        expect(setIntervalSpy).toHaveBeenCalledWith(expect.any(Function), FETCH_CHECK_INTERVAL_MS)
      } finally {
        setIntervalSpy.mockRestore()
        await watcher[Symbol.asyncDispose]()
      }
    }))

  it('stopWatching() clears interval and removes entry', async () => {
    vi.useFakeTimers()
    try {
      await withTestInjector(async ({ injector, elevated }) => {
        await addServiceDefinition(elevated)
        const mockGit = createMockGit()
        injector.setExplicitInstance(mockGit as unknown as GitService, GitService)
        const watcher = injector.getInstance(GitWatcher)

        await watcher.startWatching('svc-1')
        watcher.stopWatching('svc-1')
        mockGit.fetch.mockClear()
        await vi.advanceTimersByTimeAsync(10 * 60 * 1000)
        expect(mockGit.fetch).not.toHaveBeenCalled()
      })
    } finally {
      vi.useRealTimers()
    }
  })

  it('stopWatching() is a no-op for unknown serviceId', () =>
    withTestInjector(async ({ injector }) => {
      const mockGit = createMockGit()
      injector.setExplicitInstance(mockGit as unknown as GitService, GitService)
      const watcher = injector.getInstance(GitWatcher)

      expect(() => watcher.stopWatching('unknown')).not.toThrow()
    }))

  it('asyncDispose() clears all watchers', async () => {
    vi.useFakeTimers()
    try {
      await withTestInjector(async ({ injector, elevated }) => {
        await addServiceDefinition(elevated)
        const mockGit = createMockGit()
        injector.setExplicitInstance(mockGit as unknown as GitService, GitService)
        const watcher = injector.getInstance(GitWatcher)

        await watcher.startWatching('svc-1')
        await watcher[Symbol.asyncDispose]()
        mockGit.fetch.mockClear()
        await vi.advanceTimersByTimeAsync(10 * 60 * 1000)
        expect(mockGit.fetch).not.toHaveBeenCalled()
      })
    } finally {
      vi.useRealTimers()
    }
  })
})
