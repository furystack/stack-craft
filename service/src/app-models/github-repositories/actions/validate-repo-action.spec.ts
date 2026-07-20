import { GitHubRepositoryDataSet } from '../../data-store/tokens.js'
import { getDataSetFor } from '@furystack/repository'

import { beforeEach, describe, expect, it, vi } from 'vitest'

import { GitService } from '../../../services/git-service.js'
import { createMockActionContext, withTestInjector } from '../../../test-helpers.js'
import { ValidateRepoAction } from './validate-repo-action.js'

const lsRemoteMock = vi.fn<(url: string) => Promise<void>>()

const bindGitServiceStub = (injector: { bind: (token: typeof GitService, factory: () => GitService) => void }) => {
  injector.bind(GitService, () => ({ lsRemote: lsRemoteMock }) as unknown as GitService)
}

describe('ValidateRepoAction', () => {
  beforeEach(() => {
    lsRemoteMock.mockReset()
  })

  it('should return accessible: true when git ls-remote succeeds', async () => {
    await withTestInjector(async ({ elevated }) => {
      bindGitServiceStub(elevated)
      const ts = new Date().toISOString()
      await getDataSetFor(elevated, GitHubRepositoryDataSet).add(elevated, {
        id: 'repo-1',
        stackName: 'test-stack',
        url: 'https://github.com/user/repo.git',
        displayName: 'Test Repo',
        description: '',
        createdAt: ts,
        updatedAt: ts,
      })

      lsRemoteMock.mockResolvedValue(undefined)

      const result = await ValidateRepoAction(
        createMockActionContext({ injector: elevated, urlParams: { id: 'repo-1' } }),
      )

      const body = result.chunk as { accessible: boolean }
      expect(body.accessible).toBe(true)
      expect(lsRemoteMock).toHaveBeenCalledWith('https://github.com/user/repo.git')
    })
  })

  it('should return accessible: false when git ls-remote fails', async () => {
    await withTestInjector(async ({ elevated }) => {
      bindGitServiceStub(elevated)
      const ts = new Date().toISOString()
      await getDataSetFor(elevated, GitHubRepositoryDataSet).add(elevated, {
        id: 'repo-2',
        stackName: 'test-stack',
        url: 'https://github.com/user/bad-repo.git',
        displayName: 'Bad Repo',
        description: '',
        createdAt: ts,
        updatedAt: ts,
      })

      lsRemoteMock.mockRejectedValue(new Error('Repository not found'))

      const result = await ValidateRepoAction(
        createMockActionContext({ injector: elevated, urlParams: { id: 'repo-2' } }),
      )

      const body = result.chunk
      expect(body.accessible).toBe(false)
      expect(body.message).toContain('Repository not found')
    })
  })

  it('should throw 404 when repository does not exist', async () => {
    await withTestInjector(async ({ elevated }) => {
      bindGitServiceStub(elevated)
      await expect(
        ValidateRepoAction(createMockActionContext({ injector: elevated, urlParams: { id: 'nonexistent' } })),
      ).rejects.toThrow('Repository not found')
    })
  })
})
