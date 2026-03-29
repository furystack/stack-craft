import { addStore, InMemoryStore, useSystemIdentityContext } from '@furystack/core'
import { Injector } from '@furystack/inject'
import { useLogging, VerboseConsoleLogger } from '@furystack/logging'
import { getRepository } from '@furystack/repository'
import { usingAsync } from '@furystack/utils'
import { ServiceGitStatus } from 'common'
import { describe, expect, it, vi } from 'vitest'

import { GitService } from './git-service.js'
import { GitHeadWatcher } from './git-head-watcher.js'

vi.mock('fs', async (importOriginal) => {
  const actual = await importOriginal<typeof import('fs')>() // eslint-disable-line @typescript-eslint/consistent-type-imports
  return {
    ...actual,
    existsSync: vi.fn().mockReturnValue(true),
    watch: vi.fn().mockReturnValue({ close: vi.fn() }),
  }
})

const { existsSync, watch } = await import('fs')
const mockExistsSync = existsSync as unknown as ReturnType<typeof vi.fn>
const mockWatch = watch as unknown as ReturnType<typeof vi.fn>

const createMockGitService = () => ({
  getCurrentBranch: vi.fn().mockResolvedValue('main'),
  getCommitsBehind: vi.fn().mockResolvedValue(0),
  getBranches: vi.fn(),
  fetch: vi.fn(),
  pull: vi.fn(),
  clone: vi.fn(),
  checkout: vi.fn(),
})

const setupHeadWatcherInjector = (injector: Injector, mockGit: ReturnType<typeof createMockGitService>) => {
  useLogging(injector, VerboseConsoleLogger)
  addStore(injector, new InMemoryStore({ model: ServiceGitStatus, primaryKey: 'serviceId' }))
  getRepository(injector).createDataSet(ServiceGitStatus, 'serviceId', {})
  injector.setExplicitInstance(mockGit as unknown as GitService, GitService)
}

const withHeadWatcherContext = async (
  fn: (ctx: { injector: Injector; mockGit: ReturnType<typeof createMockGitService> }) => Promise<void>,
) => {
  const mockGit = createMockGitService()
  mockExistsSync.mockClear()
  mockExistsSync.mockReturnValue(true)
  mockWatch.mockClear()
  mockWatch.mockReturnValue({ close: vi.fn() })

  await usingAsync(new Injector(), async (injector) => {
    setupHeadWatcherInjector(injector, mockGit)
    await fn({ injector, mockGit })
  })
}

describe('GitHeadWatcher', () => {
  describe('watch', () => {
    it('should read the current branch and write git status', () =>
      withHeadWatcherContext(async ({ injector, mockGit }) => {
        const headWatcher = injector.getInstance(GitHeadWatcher)
        await headWatcher.watch('svc-1', '/tmp/repo')

        expect(mockGit.getCurrentBranch).toHaveBeenCalledWith('/tmp/repo')

        const elevated = useSystemIdentityContext({ injector })
        const results = await getRepository(elevated).getDataSetFor(ServiceGitStatus, 'serviceId').find(elevated, {})
        await elevated[Symbol.asyncDispose]()

        expect(results).toHaveLength(1)
        expect(results[0].serviceId).toBe('svc-1')
        expect(results[0].currentBranch).toBe('main')
      }))

    it('should not watch if HEAD file does not exist', () =>
      withHeadWatcherContext(async ({ injector }) => {
        mockExistsSync.mockReturnValue(false)
        const headWatcher = injector.getInstance(GitHeadWatcher)

        await headWatcher.watch('svc-2', '/tmp/no-git')

        expect(mockWatch).not.toHaveBeenCalled()
      }))

    it('should set up a file watcher on .git/HEAD', () =>
      withHeadWatcherContext(async ({ injector }) => {
        const headWatcher = injector.getInstance(GitHeadWatcher)
        await headWatcher.watch('svc-1', '/tmp/repo')

        expect(mockWatch).toHaveBeenCalledWith('/tmp/repo/.git/HEAD', expect.any(Function))
      }))

    it('should handle getCurrentBranch failure gracefully', () =>
      withHeadWatcherContext(async ({ injector, mockGit }) => {
        mockGit.getCurrentBranch.mockRejectedValue(new Error('not a repo'))
        const headWatcher = injector.getInstance(GitHeadWatcher)

        await expect(headWatcher.watch('svc-1', '/tmp/bad')).resolves.not.toThrow()
      }))

    it('should replace an existing watcher when called again for the same service', () =>
      withHeadWatcherContext(async ({ injector }) => {
        const closeFn = vi.fn()
        mockWatch.mockReturnValue({ close: closeFn })

        const headWatcher = injector.getInstance(GitHeadWatcher)
        await headWatcher.watch('svc-1', '/tmp/repo')
        await headWatcher.watch('svc-1', '/tmp/repo2')

        expect(closeFn).toHaveBeenCalledOnce()
      }))
  })

  describe('unwatch', () => {
    it('should close the watcher and remove the entry', () =>
      withHeadWatcherContext(async ({ injector }) => {
        const closeFn = vi.fn()
        mockWatch.mockReturnValue({ close: closeFn })

        const headWatcher = injector.getInstance(GitHeadWatcher)
        await headWatcher.watch('svc-1', '/tmp/repo')

        headWatcher.unwatch('svc-1')

        expect(closeFn).toHaveBeenCalledOnce()
      }))

    it('should be a no-op for an unknown service', () =>
      withHeadWatcherContext(async ({ injector }) => {
        const headWatcher = injector.getInstance(GitHeadWatcher)
        expect(() => headWatcher.unwatch('nonexistent')).not.toThrow()
      }))
  })

  describe('onHeadChanged callback', () => {
    it('should update git status when HEAD changes', () =>
      withHeadWatcherContext(async ({ injector, mockGit }) => {
        vi.useFakeTimers()
        try {
          let fileChangeCallback: (() => void) | undefined
          mockWatch.mockImplementation((_path: string, cb: () => void) => {
            fileChangeCallback = cb
            return { close: vi.fn() }
          })

          const headWatcher = injector.getInstance(GitHeadWatcher)
          await headWatcher.watch('svc-1', '/tmp/repo')

          mockGit.getCurrentBranch.mockResolvedValue('feature-branch')
          mockGit.getCommitsBehind.mockResolvedValue(3)

          fileChangeCallback?.()
          vi.advanceTimersByTime(300)
          await vi.waitFor(async () => {
            const elevated = useSystemIdentityContext({ injector })
            const results = await getRepository(elevated)
              .getDataSetFor(ServiceGitStatus, 'serviceId')
              .find(elevated, {})
            await elevated[Symbol.asyncDispose]()
            expect(results[0].currentBranch).toBe('feature-branch')
          })
        } finally {
          vi.useRealTimers()
        }
      }))
  })

  describe('Symbol.asyncDispose', () => {
    it('should close all watchers', () =>
      withHeadWatcherContext(async ({ injector }) => {
        const closeFn = vi.fn()
        mockWatch.mockReturnValue({ close: closeFn })

        const headWatcher = injector.getInstance(GitHeadWatcher)
        await headWatcher.watch('svc-1', '/tmp/repo')

        await headWatcher[Symbol.asyncDispose]()

        expect(closeFn).toHaveBeenCalled()
      }))
  })
})
