import type { Injector } from '@furystack/inject'
import { getRepository } from '@furystack/repository'

import { beforeEach, describe, expect, it, vi } from 'vitest'

import { ServiceDefinition, ServiceStatus } from 'common'

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
  hasRemoteBranch: vi.fn().mockResolvedValue(true),
  getWorktreeStatus: vi.fn().mockResolvedValue('clean' as const),
  pull: vi.fn().mockResolvedValue({ updated: false }),
})

const flushMicrotasks = async () => {
  for (let i = 0; i < 5; i++) await Promise.resolve()
}

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
        // initial getBranches is called once via startWatching and again via the immediate fetchAndCheck
        mockGit.getBranches.mockClear()
        await watcher.startWatching('svc-1')
        expect(mockGit.getBranches).not.toHaveBeenCalled()
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
        // flush the immediate fetchAndCheck so it doesn't race with mockClear below
        await flushMicrotasks()
        watcher.stopWatching('svc-1')
        await flushMicrotasks()
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
        await flushMicrotasks()
        await watcher[Symbol.asyncDispose]()
        await flushMicrotasks()
        mockGit.fetch.mockClear()
        await vi.advanceTimersByTimeAsync(10 * 60 * 1000)
        expect(mockGit.fetch).not.toHaveBeenCalled()
      })
    } finally {
      vi.useRealTimers()
    }
  })

  it('updates upstreamStatus to "present" and records worktree status on a normal fetch', () =>
    withTestInjector(async ({ injector, elevated }) => {
      await addServiceDefinition(elevated)
      await getRepository(elevated).getDataSetFor(ServiceStatus, 'serviceId').add(elevated, {
        serviceId: 'svc-1',
        cloneStatus: 'cloned',
        installStatus: 'not-installed',
        buildStatus: 'not-built',
        runStatus: 'stopped',
        updatedAt: new Date().toISOString(),
      })

      const mockGit = createMockGit()
      mockGit.getWorktreeStatus.mockResolvedValue('dirty')
      injector.setExplicitInstance(mockGit as unknown as GitService, GitService)
      const watcher = injector.getInstance(GitWatcher)

      try {
        await watcher.startWatching('svc-1')
        await vi.waitFor(
          async () => {
            const { ServiceGitStatus } = await import('common')
            const rows = await getRepository(elevated)
              .getDataSetFor(ServiceGitStatus, 'serviceId')
              .find(elevated, { filter: { serviceId: { $eq: 'svc-1' } }, top: 1 })
            expect(rows[0]?.upstreamStatus).toBe('present')
            expect(rows[0]?.worktreeStatus).toBe('dirty')
          },
          { timeout: 1000 },
        )
      } finally {
        await watcher[Symbol.asyncDispose]()
      }
    }))

  it('updates upstreamStatus to "gone" when origin/<branch> disappears', () =>
    withTestInjector(async ({ injector, elevated }) => {
      await addServiceDefinition(elevated)
      await getRepository(elevated).getDataSetFor(ServiceStatus, 'serviceId').add(elevated, {
        serviceId: 'svc-1',
        cloneStatus: 'cloned',
        installStatus: 'not-installed',
        buildStatus: 'not-built',
        runStatus: 'stopped',
        updatedAt: new Date().toISOString(),
      })

      const mockGit = createMockGit()
      mockGit.hasRemoteBranch.mockResolvedValue(false)
      injector.setExplicitInstance(mockGit as unknown as GitService, GitService)
      const watcher = injector.getInstance(GitWatcher)

      try {
        await watcher.startWatching('svc-1')
        await vi.waitFor(
          async () => {
            const { ServiceGitStatus } = await import('common')
            const rows = await getRepository(elevated)
              .getDataSetFor(ServiceGitStatus, 'serviceId')
              .find(elevated, { filter: { serviceId: { $eq: 'svc-1' } }, top: 1 })
            expect(rows[0]?.upstreamStatus).toBe('gone')
          },
          { timeout: 1000 },
        )
      } finally {
        await watcher[Symbol.asyncDispose]()
      }
    }))
})
