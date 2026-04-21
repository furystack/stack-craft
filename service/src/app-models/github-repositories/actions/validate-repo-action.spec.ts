import { getRepository } from '@furystack/repository'
import { GitHubRepository } from 'common'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { createMockActionContext, withTestInjector } from '../../../test-helpers.js'
import { ValidateRepoAction } from './validate-repo-action.js'

const execFileMock = vi.hoisted(() =>
  vi.fn<(cmd: string, args: string[], options: { timeout: number }) => Promise<{ stdout: string; stderr: string }>>(),
)

vi.mock('child_process', () => ({
  execFile: (...args: unknown[]) => execFileMock(...(args as [string, string[], { timeout: number }])),
}))

vi.mock('util', () => ({
  promisify: () => execFileMock,
}))

describe('ValidateRepoAction', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should return accessible: true when git ls-remote succeeds', async () => {
    await withTestInjector(async ({ elevated }) => {
      const ts = new Date().toISOString()
      await getRepository(elevated).getDataSetFor(GitHubRepository, 'id').add(elevated, {
        id: 'repo-1',
        stackName: 'test-stack',
        url: 'https://github.com/user/repo.git',
        displayName: 'Test Repo',
        description: '',
        createdAt: ts,
        updatedAt: ts,
      })

      execFileMock.mockResolvedValue({ stdout: 'abc123\tHEAD\n', stderr: '' })

      const result = await ValidateRepoAction(
        createMockActionContext({ injector: elevated, urlParams: { id: 'repo-1' } }),
      )

      const body = result.chunk as { accessible: boolean }
      expect(body.accessible).toBe(true)
      expect(execFileMock).toHaveBeenCalledWith(
        'git',
        ['ls-remote', '--exit-code', 'https://github.com/user/repo.git'],
        {
          timeout: 15000,
        },
      )
    })
  })

  it('should return accessible: false when git ls-remote fails', async () => {
    await withTestInjector(async ({ elevated }) => {
      const ts = new Date().toISOString()
      await getRepository(elevated).getDataSetFor(GitHubRepository, 'id').add(elevated, {
        id: 'repo-2',
        stackName: 'test-stack',
        url: 'https://github.com/user/bad-repo.git',
        displayName: 'Bad Repo',
        description: '',
        createdAt: ts,
        updatedAt: ts,
      })

      execFileMock.mockRejectedValue(new Error('Repository not found'))

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
      await expect(
        ValidateRepoAction(createMockActionContext({ injector: elevated, urlParams: { id: 'nonexistent' } })),
      ).rejects.toThrow('Repository not found')
    })
  })
})
