import type { FSWatcher } from 'fs'

import { getRepository } from '@furystack/repository'
import { ServiceGitStatus } from 'common'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { withTestInjector } from '../test-helpers.js'
import { GitHeadWatcher } from './git-head-watcher.js'
import { GitService } from './git-service.js'

const { mockExistsSync, mockWatch, mockWatcherClose } = vi.hoisted(() => {
  const watcherClose = vi.fn()
  return {
    mockExistsSync: vi.fn(),
    mockWatch: vi.fn(),
    mockWatcherClose: watcherClose,
  }
})

vi.mock('fs', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>()
  return { ...actual, existsSync: mockExistsSync, watch: mockWatch }
})

beforeEach(() => {
  vi.clearAllMocks()
  mockExistsSync.mockReturnValue(false)
  mockWatch.mockReturnValue({ close: mockWatcherClose })
})

describe('GitHeadWatcher', () => {
  it('does nothing when .git/HEAD does not exist', () =>
    withTestInjector(async ({ injector, elevated }) => {
      mockExistsSync.mockReturnValue(false)
      const mockGit = {
        getCurrentBranch: vi.fn(),
        getCommitsBehind: vi.fn(),
      }
      injector.setExplicitInstance(mockGit as unknown as GitService, GitService)
      const headWatcher = injector.getInstance(GitHeadWatcher)
      await headWatcher.watch('svc-1', '/tmp/repo')

      expect(mockWatch).not.toHaveBeenCalled()
      expect(mockGit.getCurrentBranch).not.toHaveBeenCalled()
      const rows = await getRepository(elevated)
        .getDataSetFor(ServiceGitStatus, 'serviceId')
        .find(elevated, { filter: { serviceId: { $eq: 'svc-1' } } })
      expect(rows).toHaveLength(0)
    }))

  it('reads the current branch and creates a ServiceGitStatus record', () =>
    withTestInjector(async ({ injector, elevated }) => {
      mockExistsSync.mockReturnValue(true)
      const mockGit = {
        getCurrentBranch: vi.fn().mockResolvedValue('main'),
        getCommitsBehind: vi.fn(),
      }
      injector.setExplicitInstance(mockGit as unknown as GitService, GitService)
      const headWatcher = injector.getInstance(GitHeadWatcher)
      await headWatcher.watch('svc-create', '/tmp/repo')

      expect(mockGit.getCurrentBranch).toHaveBeenCalledWith('/tmp/repo')
      const rows = await getRepository(elevated)
        .getDataSetFor(ServiceGitStatus, 'serviceId')
        .find(elevated, { filter: { serviceId: { $eq: 'svc-create' } } })
      expect(rows).toHaveLength(1)
      expect(rows[0]).toMatchObject({ serviceId: 'svc-create', currentBranch: 'main' })
    }))

  it('updates an existing ServiceGitStatus when one already exists', () =>
    withTestInjector(async ({ injector, elevated }) => {
      mockExistsSync.mockReturnValue(true)
      const ds = getRepository(elevated).getDataSetFor(ServiceGitStatus, 'serviceId')
      await ds.add(elevated, { serviceId: 'svc-upd', currentBranch: 'old' })

      const mockGit = {
        getCurrentBranch: vi.fn().mockResolvedValue('new-branch'),
        getCommitsBehind: vi.fn(),
      }
      injector.setExplicitInstance(mockGit as unknown as GitService, GitService)
      const headWatcher = injector.getInstance(GitHeadWatcher)
      await headWatcher.watch('svc-upd', '/tmp/repo')

      const rows = await ds.find(elevated, { filter: { serviceId: { $eq: 'svc-upd' } } })
      expect(rows).toHaveLength(1)
      expect(rows[0]).toMatchObject({ serviceId: 'svc-upd', currentBranch: 'new-branch' })
    }))

  it('unwatch closes the watcher and removes the entry', () =>
    withTestInjector(async ({ injector }) => {
      mockExistsSync.mockReturnValue(true)
      const mockGit = {
        getCurrentBranch: vi.fn().mockResolvedValue('main'),
        getCommitsBehind: vi.fn(),
      }
      injector.setExplicitInstance(mockGit as unknown as GitService, GitService)
      const headWatcher = injector.getInstance(GitHeadWatcher)
      await headWatcher.watch('svc-unwatch', '/tmp/repo')
      headWatcher.unwatch('svc-unwatch')

      expect(mockWatcherClose).toHaveBeenCalledTimes(1)
    }))

  it('unwatch is a no-op for an unknown serviceId', () =>
    withTestInjector(async ({ injector }) => {
      const mockGit = {
        getCurrentBranch: vi.fn(),
        getCommitsBehind: vi.fn(),
      }
      injector.setExplicitInstance(mockGit as unknown as GitService, GitService)
      const headWatcher = injector.getInstance(GitHeadWatcher)
      expect(() => headWatcher.unwatch('unknown')).not.toThrow()
      expect(mockWatcherClose).not.toHaveBeenCalled()
    }))

  it('asyncDispose closes all watchers', () =>
    withTestInjector(async ({ injector }) => {
      mockExistsSync.mockReturnValue(true)
      const closeA = vi.fn()
      const closeB = vi.fn()
      mockWatch.mockReturnValueOnce({ close: closeA })
      mockWatch.mockReturnValueOnce({ close: closeB })

      const mockGit = {
        getCurrentBranch: vi.fn().mockResolvedValue('main'),
        getCommitsBehind: vi.fn(),
      }
      injector.setExplicitInstance(mockGit as unknown as GitService, GitService)
      const headWatcher = injector.getInstance(GitHeadWatcher)
      await headWatcher.watch('svc-a', '/tmp/a')
      await headWatcher.watch('svc-b', '/tmp/b')
      await headWatcher[Symbol.asyncDispose]()

      expect(closeA).toHaveBeenCalledTimes(1)
      expect(closeB).toHaveBeenCalledTimes(1)
    }))
})
