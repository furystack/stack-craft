import { getRepository } from '@furystack/repository'
import { ServiceDefinition, ServiceStatus } from 'common'
import { describe, expect, it, vi } from 'vitest'

import { GitHeadWatcher } from '../../../services/git-head-watcher.js'
import { GitService } from '../../../services/git-service.js'
import { createMockActionContext, withTestInjector } from '../../../test-helpers.js'
import { ServiceDeleteBranchAction } from './service-delete-branch-action.js'

const seed = async (
  elevated: Parameters<Parameters<typeof withTestInjector>[0]>[0]['elevated'],
  status: Partial<ServiceStatus> = {},
) => {
  const ts = new Date().toISOString()
  await getRepository(elevated).getDataSetFor(ServiceDefinition, 'id').add(elevated, {
    id: 'svc-1',
    stackName: 'stack',
    displayName: 'Test',
    description: '',
    runCommand: 'npm start',
    repositoryId: 'repo-1',
    files: [],
    createdAt: ts,
    updatedAt: ts,
  })
  await getRepository(elevated)
    .getDataSetFor(ServiceStatus, 'serviceId')
    .add(elevated, {
      serviceId: 'svc-1',
      cloneStatus: 'cloned',
      installStatus: 'not-installed',
      buildStatus: 'not-built',
      runStatus: 'stopped',
      updatedAt: ts,
      ...status,
    })
}

const mockGit = (overrides: Partial<GitService> = {}) =>
  ({
    getCurrentBranch: vi.fn().mockResolvedValue('main'),
    deleteLocalBranch: vi.fn().mockResolvedValue(undefined),
    checkout: vi.fn().mockResolvedValue(undefined),
    getDefaultBranch: vi.fn().mockResolvedValue('main'),
    ...overrides,
  }) as unknown as GitService

vi.mock('../../../utils/resolve-service-cwd.js', () => ({
  resolveServiceCwd: vi.fn().mockResolvedValue('/tmp/repo'),
}))

describe('ServiceDeleteBranchAction', () => {
  it('deletes a local branch that is not currently checked out', () =>
    withTestInjector(async ({ injector, elevated }) => {
      await seed(elevated)
      const git = mockGit({
        getCurrentBranch: vi.fn().mockResolvedValue('main'),
      })
      injector.setExplicitInstance(git, GitService)
      injector.setExplicitInstance({ watch: vi.fn() } as unknown as GitHeadWatcher, GitHeadWatcher)

      const ctx = createMockActionContext({
        injector,
        urlParams: { id: 'svc-1' },
        body: { branch: 'feature/old' },
      })
      const result = await ServiceDeleteBranchAction(ctx)
      expect(result.chunk).toMatchObject({ success: true, deleted: 'feature/old' })
      expect(git.deleteLocalBranch).toHaveBeenCalledWith('/tmp/repo', 'feature/old', false)
      expect(git.checkout).not.toHaveBeenCalled()
    }))

  it('switches to the default branch when the target branch is checked out', () =>
    withTestInjector(async ({ injector, elevated }) => {
      await seed(elevated)
      const git = mockGit({
        getCurrentBranch: vi.fn().mockResolvedValue('feature/gone'),
        getDefaultBranch: vi.fn().mockResolvedValue('main'),
      })
      injector.setExplicitInstance(git, GitService)
      injector.setExplicitInstance({ watch: vi.fn() } as unknown as GitHeadWatcher, GitHeadWatcher)

      const ctx = createMockActionContext({
        injector,
        urlParams: { id: 'svc-1' },
        body: { branch: 'feature/gone', force: true },
      })
      const result = await ServiceDeleteBranchAction(ctx)
      expect(git.checkout).toHaveBeenCalledWith('/tmp/repo', 'main')
      expect(git.deleteLocalBranch).toHaveBeenCalledWith('/tmp/repo', 'feature/gone', true)
      expect(result.chunk).toMatchObject({ success: true, deleted: 'feature/gone', switchedTo: 'main' })
    }))

  it('omits switchedTo from the response when no branch switch happened', () =>
    withTestInjector(async ({ injector, elevated }) => {
      await seed(elevated)
      const git = mockGit({
        getCurrentBranch: vi.fn().mockResolvedValue('main'),
      })
      injector.setExplicitInstance(git, GitService)
      injector.setExplicitInstance({ watch: vi.fn() } as unknown as GitHeadWatcher, GitHeadWatcher)

      const ctx = createMockActionContext({
        injector,
        urlParams: { id: 'svc-1' },
        body: { branch: 'feature/old' },
      })
      const result = await ServiceDeleteBranchAction(ctx)
      expect(result.chunk).not.toHaveProperty('switchedTo')
    }))

  it('throws when the repository is not cloned yet', () =>
    withTestInjector(async ({ injector, elevated }) => {
      await seed(elevated, { cloneStatus: 'not-cloned' })
      injector.setExplicitInstance(mockGit(), GitService)
      injector.setExplicitInstance({ watch: vi.fn() } as unknown as GitHeadWatcher, GitHeadWatcher)

      const ctx = createMockActionContext({
        injector,
        urlParams: { id: 'svc-1' },
        body: { branch: 'feature/gone' },
      })
      await expect(ServiceDeleteBranchAction(ctx)).rejects.toThrow('Repository is not cloned')
    }))

  it('uses an explicit switchTo over the default branch when provided', () =>
    withTestInjector(async ({ injector, elevated }) => {
      await seed(elevated)
      const git = mockGit({
        getCurrentBranch: vi.fn().mockResolvedValue('feature/gone'),
        getDefaultBranch: vi.fn().mockResolvedValue('main'),
      })
      injector.setExplicitInstance(git, GitService)
      injector.setExplicitInstance({ watch: vi.fn() } as unknown as GitHeadWatcher, GitHeadWatcher)

      const ctx = createMockActionContext({
        injector,
        urlParams: { id: 'svc-1' },
        body: { branch: 'feature/gone', switchTo: 'develop' },
      })
      await ServiceDeleteBranchAction(ctx)
      expect(git.checkout).toHaveBeenCalledWith('/tmp/repo', 'develop')
    }))

  it('throws when service does not exist', () =>
    withTestInjector(async ({ injector }) => {
      injector.setExplicitInstance(mockGit(), GitService)
      injector.setExplicitInstance({ watch: vi.fn() } as unknown as GitHeadWatcher, GitHeadWatcher)

      const ctx = createMockActionContext({
        injector,
        urlParams: { id: 'missing' },
        body: { branch: 'x' },
      })
      await expect(ServiceDeleteBranchAction(ctx)).rejects.toThrow('Service not found')
    }))

  it('throws when currently on target branch and no default branch / switchTo is provided', () =>
    withTestInjector(async ({ injector, elevated }) => {
      await seed(elevated)
      const git = mockGit({
        getCurrentBranch: vi.fn().mockResolvedValue('feature/gone'),
        getDefaultBranch: vi.fn().mockResolvedValue(undefined),
      })
      injector.setExplicitInstance(git, GitService)
      injector.setExplicitInstance({ watch: vi.fn() } as unknown as GitHeadWatcher, GitHeadWatcher)

      const ctx = createMockActionContext({
        injector,
        urlParams: { id: 'svc-1' },
        body: { branch: 'feature/gone' },
      })
      await expect(ServiceDeleteBranchAction(ctx)).rejects.toThrow('while it is checked out')
    }))
})
