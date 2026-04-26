import { ServiceGitStatusDataSet } from '../app-models/data-store/tokens.js'
import { getDataSetFor } from '@furystack/repository'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { withTestInjector } from '../test-helpers.js'
import { GitHeadWatcher } from './git-head-watcher.js'
import { GitService } from './git-service.js'
import '../test-shims.js'
const { mockExistsSync, mockChokidarWatch, watcherFactory } = vi.hoisted(() => {
  const createWatcher = () => {
    const handlers = new Map<string, Array<(...args: unknown[]) => void>>()
    const watcher = {
      on: vi.fn((event: string, handler: (...args: unknown[]) => void) => {
        const list = handlers.get(event) ?? []
        list.push(handler)
        handlers.set(event, list)
        return watcher
      }),
      close: vi.fn().mockResolvedValue(undefined),
      trigger: (event: string, ...args: unknown[]) => {
        for (const h of handlers.get(event) ?? []) h(...args)
      },
    }
    return watcher
  }
  return {
    mockExistsSync: vi.fn(),
    mockChokidarWatch: vi.fn(() => createWatcher()),
    watcherFactory: createWatcher,
  }
})

vi.mock('fs', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>()
  return { ...actual, existsSync: mockExistsSync }
})

vi.mock('chokidar', () => ({
  default: { watch: mockChokidarWatch },
  watch: mockChokidarWatch,
}))

const createMockGit = () => ({
  getCurrentBranch: vi.fn().mockResolvedValue('main'),
  getCommitsBehind: vi.fn().mockResolvedValue(0),
  revParse: vi.fn().mockResolvedValue('deadbeef'),
})

beforeEach(() => {
  vi.clearAllMocks()
  mockExistsSync.mockReturnValue(false)
  mockChokidarWatch.mockImplementation(() => watcherFactory())
})

describe('GitHeadWatcher', () => {
  it('does nothing when .git/HEAD does not exist', () =>
    withTestInjector(async ({ injector, elevated }) => {
      mockExistsSync.mockReturnValue(false)
      const mockGit = createMockGit()
      injector.setExplicitInstance(mockGit as unknown as GitService, GitService)

      const headWatcher = injector.get(GitHeadWatcher)
      await headWatcher.watch('svc-1', '/tmp/repo')

      expect(mockChokidarWatch).not.toHaveBeenCalled()
      expect(mockGit.getCurrentBranch).not.toHaveBeenCalled()
      const rows = await getDataSetFor(elevated, ServiceGitStatusDataSet).find(elevated, {
        filter: { serviceId: { $eq: 'svc-1' } },
      })
      expect(rows).toHaveLength(0)
    }))

  it('reads the current branch and creates a ServiceGitStatus record', () =>
    withTestInjector(async ({ injector, elevated }) => {
      mockExistsSync.mockReturnValue(true)
      const mockGit = createMockGit()
      injector.setExplicitInstance(mockGit as unknown as GitService, GitService)

      const headWatcher = injector.get(GitHeadWatcher)
      await headWatcher.watch('svc-create', '/tmp/repo')

      expect(mockGit.getCurrentBranch).toHaveBeenCalledWith('/tmp/repo')
      const rows = await getDataSetFor(elevated, ServiceGitStatusDataSet).find(elevated, {
        filter: { serviceId: { $eq: 'svc-create' } },
      })
      expect(rows).toHaveLength(1)
      expect(rows[0]).toMatchObject({ serviceId: 'svc-create', currentBranch: 'main' })
    }))

  it('updates an existing ServiceGitStatus when one already exists', () =>
    withTestInjector(async ({ injector, elevated }) => {
      mockExistsSync.mockReturnValue(true)
      const ds = getDataSetFor(elevated, ServiceGitStatusDataSet)
      await ds.add(elevated, { serviceId: 'svc-upd', currentBranch: 'old' })

      const mockGit = createMockGit()
      mockGit.getCurrentBranch.mockResolvedValue('new-branch')
      injector.setExplicitInstance(mockGit as unknown as GitService, GitService)

      const headWatcher = injector.get(GitHeadWatcher)
      await headWatcher.watch('svc-upd', '/tmp/repo')

      const rows = await ds.find(elevated, { filter: { serviceId: { $eq: 'svc-upd' } } })
      expect(rows).toHaveLength(1)
      expect(rows[0]).toMatchObject({ serviceId: 'svc-upd', currentBranch: 'new-branch' })
    }))

  it('emits externalChange when the branch changes', () =>
    withTestInjector(async ({ injector }) => {
      mockExistsSync.mockReturnValue(true)
      const mockGit = createMockGit()
      mockGit.getCurrentBranch.mockResolvedValueOnce('main').mockResolvedValueOnce('feature/new')
      mockGit.revParse.mockResolvedValueOnce('sha-main').mockResolvedValueOnce('sha-feature')
      injector.setExplicitInstance(mockGit as unknown as GitService, GitService)

      const createdWatcher = watcherFactory()
      mockChokidarWatch.mockReturnValueOnce(createdWatcher)

      const headWatcher = injector.get(GitHeadWatcher)
      const events: unknown[] = []
      headWatcher.on('externalChange', (payload) => events.push(payload))

      await headWatcher.watch('svc-switch', '/tmp/repo')
      createdWatcher.trigger('change', '/tmp/repo/.git/HEAD')
      await vi.waitFor(() => expect(events).toHaveLength(1), { timeout: 500 })

      expect(events[0]).toMatchObject({
        serviceId: 'svc-switch',
        kind: 'branch-switched',
        previousBranch: 'main',
        currentBranch: 'feature/new',
      })
    }))

  it('emits externalChange of kind pull-detected when branch ref SHA changes', () =>
    withTestInjector(async ({ injector }) => {
      mockExistsSync.mockReturnValue(true)
      const mockGit = createMockGit()
      mockGit.getCurrentBranch.mockResolvedValue('main')
      mockGit.revParse.mockResolvedValueOnce('sha-old').mockResolvedValueOnce('sha-new')
      injector.setExplicitInstance(mockGit as unknown as GitService, GitService)

      const createdWatcher = watcherFactory()
      mockChokidarWatch.mockReturnValueOnce(createdWatcher)

      const headWatcher = injector.get(GitHeadWatcher)
      const events: unknown[] = []
      headWatcher.on('externalChange', (payload) => events.push(payload))

      await headWatcher.watch('svc-pull', '/tmp/repo')
      createdWatcher.trigger('change', '/tmp/repo/.git/refs/heads/main')
      await vi.waitFor(() => expect(events).toHaveLength(1), { timeout: 500 })

      expect(events[0]).toMatchObject({ serviceId: 'svc-pull', kind: 'pull-detected' })
    }))

  it('unwatch closes the watcher and removes the entry', () =>
    withTestInjector(async ({ injector }) => {
      mockExistsSync.mockReturnValue(true)
      const mockGit = createMockGit()
      injector.setExplicitInstance(mockGit as unknown as GitService, GitService)

      const createdWatcher = watcherFactory()
      mockChokidarWatch.mockReturnValueOnce(createdWatcher)

      const headWatcher = injector.get(GitHeadWatcher)
      await headWatcher.watch('svc-unwatch', '/tmp/repo')
      headWatcher.unwatch('svc-unwatch')

      expect(createdWatcher.close).toHaveBeenCalledTimes(1)
    }))

  it('unwatch is a no-op for an unknown serviceId', () =>
    withTestInjector(async ({ injector }) => {
      const mockGit = createMockGit()
      injector.setExplicitInstance(mockGit as unknown as GitService, GitService)

      const headWatcher = injector.get(GitHeadWatcher)
      expect(() => headWatcher.unwatch('unknown')).not.toThrow()
    }))

  it('asyncDispose closes all watchers', () =>
    withTestInjector(async ({ injector }) => {
      mockExistsSync.mockReturnValue(true)
      const mockGit = createMockGit()
      injector.setExplicitInstance(mockGit as unknown as GitService, GitService)

      const a = watcherFactory()
      const b = watcherFactory()
      mockChokidarWatch.mockReturnValueOnce(a).mockReturnValueOnce(b)

      const headWatcher = injector.get(GitHeadWatcher)
      await headWatcher.watch('svc-a', '/tmp/a')
      await headWatcher.watch('svc-b', '/tmp/b')
      await headWatcher[Symbol.asyncDispose]()

      expect(a.close).toHaveBeenCalledTimes(1)
      expect(b.close).toHaveBeenCalledTimes(1)
    }))
})
