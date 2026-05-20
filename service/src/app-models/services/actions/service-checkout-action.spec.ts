import { RequestError } from '@furystack/rest'
import { tmpdir } from 'os'
import { join } from 'path'
import { describe, expect, it, vi } from 'vitest'

import type { Injector } from '@furystack/inject'
import { GitHeadWatcher } from '../../../services/git-head-watcher.js'
import { GitService } from '../../../services/git-service.js'
import { createMockActionContext, withTestInjector } from '../../../test-helpers.js'
import { ServiceCheckoutAction } from './service-checkout-action.js'
import { legacyRepository as getRepository } from '../../../utils/legacy-repository.js'
import '../../../test-shims.js'

const seedClonedService = async (elevated: Injector) => {
  const repo = getRepository(elevated)
  await repo.getDataSetFor((await import('common')).StackConfig, 'stackName').add(elevated, {
    stackName: 'stack-1',
    mainDirectory: join(tmpdir(), 'stacks'),
    environmentVariables: {},
    createdAt: '',
    updatedAt: '',
  })
  await repo.getDataSetFor((await import('common')).ServiceDefinition, 'id').add(elevated, {
    id: 'svc-1',
    stackName: 'stack-1',
    displayName: 'Test',
    description: '',
    runCommand: 'npm start',
    files: [],
    createdAt: '',
    updatedAt: '',
  })
  await repo.getDataSetFor((await import('common')).ServiceStatus, 'serviceId').add(elevated, {
    serviceId: 'svc-1',
    cloneStatus: 'cloned',
    installStatus: 'not-installed',
    buildStatus: 'not-built',
    runStatus: 'stopped',
    updatedAt: '',
  })
}

describe('ServiceCheckoutAction', () => {
  it('should throw 404 when service not found', () =>
    withTestInjector(async ({ elevated }) => {
      const ctx = createMockActionContext({
        injector: elevated,
        urlParams: { id: 'nonexistent' },
        body: { branch: 'dev' },
      })
      await expect(ServiceCheckoutAction(ctx)).rejects.toThrow(RequestError)
    }))

  it('should throw 400 when not cloned', () =>
    withTestInjector(async ({ elevated }) => {
      const repo = getRepository(elevated)
      await repo.getDataSetFor((await import('common')).ServiceDefinition, 'id').add(elevated, {
        id: 'svc-1',
        stackName: 'stack-1',
        displayName: 'Test',
        description: '',
        runCommand: 'npm start',
        files: [],
        createdAt: '',
        updatedAt: '',
      })
      await repo.getDataSetFor((await import('common')).ServiceStatus, 'serviceId').add(elevated, {
        serviceId: 'svc-1',
        cloneStatus: 'not-cloned',
        installStatus: 'not-installed',
        buildStatus: 'not-built',
        runStatus: 'stopped',
        updatedAt: '',
      })

      const ctx = createMockActionContext({
        injector: elevated,
        urlParams: { id: 'svc-1' },
        body: { branch: 'dev' },
      })
      await expect(ServiceCheckoutAction(ctx)).rejects.toThrow('Repository is not cloned yet')
    }))

  it('should checkout branch and refresh git status', () =>
    withTestInjector(async ({ injector, elevated }) => {
      const mockGit = {
        checkout: vi.fn().mockResolvedValue(undefined),
        getCurrentBranch: vi.fn().mockResolvedValue('dev'),
        getCommitsBehind: vi.fn().mockResolvedValue(0),
      }
      injector.setExplicitInstance(mockGit as unknown as GitService, GitService)

      const mockHeadWatcher = { watch: vi.fn().mockResolvedValue(undefined) }
      injector.setExplicitInstance(mockHeadWatcher as unknown as GitHeadWatcher, GitHeadWatcher)

      await seedClonedService(elevated)

      const ctx = createMockActionContext({
        injector: elevated,
        urlParams: { id: 'svc-1' },
        body: { branch: 'dev' },
      })
      const result = await ServiceCheckoutAction(ctx)
      const body = result.chunk

      expect(body.success).toBe(true)
      expect(body.serviceId).toBe('svc-1')
      expect(mockGit.checkout).toHaveBeenCalledWith(expect.any(String), 'dev')
      expect(mockHeadWatcher.watch).toHaveBeenCalledWith('svc-1', expect.any(String))
    }))

  it('should strip origin/ prefix from remote branch names', () =>
    withTestInjector(async ({ injector, elevated }) => {
      const mockGit = {
        checkout: vi.fn().mockResolvedValue(undefined),
        getCurrentBranch: vi.fn().mockResolvedValue('feature/new'),
        getCommitsBehind: vi.fn().mockResolvedValue(0),
      }
      injector.setExplicitInstance(mockGit as unknown as GitService, GitService)

      const mockHeadWatcher = { watch: vi.fn().mockResolvedValue(undefined) }
      injector.setExplicitInstance(mockHeadWatcher as unknown as GitHeadWatcher, GitHeadWatcher)

      await seedClonedService(elevated)

      const ctx = createMockActionContext({
        injector: elevated,
        urlParams: { id: 'svc-1' },
        body: { branch: 'origin/feature/new' },
      })
      await ServiceCheckoutAction(ctx)

      expect(mockGit.checkout).toHaveBeenCalledWith(expect.any(String), 'feature/new')
      expect(mockHeadWatcher.watch).toHaveBeenCalledWith('svc-1', expect.any(String))
    }))

  it('should not refresh git status when checkout fails', () =>
    withTestInjector(async ({ injector, elevated }) => {
      const mockGit = {
        checkout: vi.fn().mockRejectedValue(new Error('conflict')),
        getCurrentBranch: vi.fn().mockResolvedValue('main'),
        getCommitsBehind: vi.fn().mockResolvedValue(0),
      }
      injector.setExplicitInstance(mockGit as unknown as GitService, GitService)

      const mockHeadWatcher = { watch: vi.fn().mockResolvedValue(undefined) }
      injector.setExplicitInstance(mockHeadWatcher as unknown as GitHeadWatcher, GitHeadWatcher)

      await seedClonedService(elevated)

      const ctx = createMockActionContext({
        injector: elevated,
        urlParams: { id: 'svc-1' },
        body: { branch: 'broken-branch' },
      })
      await expect(ServiceCheckoutAction(ctx)).rejects.toThrow('Failed to checkout branch')
      expect(mockHeadWatcher.watch).not.toHaveBeenCalled()
    }))
})
