import { addStore, InMemoryStore, useSystemIdentityContext } from '@furystack/core'
import { Injector } from '@furystack/inject'
import { useLogging, VerboseConsoleLogger } from '@furystack/logging'
import { getRepository } from '@furystack/repository'
import { usingAsync } from '@furystack/utils'
import { GitHubRepository } from 'common'
import { beforeEach, describe, expect, it, vi } from 'vitest'

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

const createMockActionContext = (options: { injector: Injector; urlParams?: Record<string, string> }) => ({
  injector: options.injector,
  getBody: () => Promise.resolve(undefined as never),
  getUrlParams: () => (options.urlParams ?? {}) as never,
  getQuery: () => ({}) as never,
  request: {} as never,
  response: {} as never,
})

const createSetup = () => {
  const injector = new Injector()
  useLogging(injector, VerboseConsoleLogger)
  const repoStore = new InMemoryStore({ model: GitHubRepository, primaryKey: 'id' })
  addStore(injector, repoStore)
  getRepository(injector).createDataSet(GitHubRepository, 'id', {})
  return { injector, repoStore }
}

describe('ValidateRepoAction', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should return accessible: true when git ls-remote succeeds', () => {
    const { injector, repoStore } = createSetup()
    return usingAsync(injector, async () => {
      const ts = new Date().toISOString()
      await repoStore.add({
        id: 'repo-1',
        stackName: 'test-stack',
        url: 'https://github.com/user/repo.git',
        displayName: 'Test Repo',
        description: '',
        createdAt: ts,
        updatedAt: ts,
      } as GitHubRepository)

      execFileMock.mockResolvedValue({ stdout: 'abc123\tHEAD\n', stderr: '' })

      const elevated = useSystemIdentityContext({ injector })
      const result = await ValidateRepoAction(
        createMockActionContext({ injector: elevated, urlParams: { id: 'repo-1' } }),
      )
      await elevated[Symbol.asyncDispose]()

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

  it('should return accessible: false when git ls-remote fails', () => {
    const { injector, repoStore } = createSetup()
    return usingAsync(injector, async () => {
      const ts = new Date().toISOString()
      await repoStore.add({
        id: 'repo-2',
        stackName: 'test-stack',
        url: 'https://github.com/user/bad-repo.git',
        displayName: 'Bad Repo',
        description: '',
        createdAt: ts,
        updatedAt: ts,
      } as GitHubRepository)

      execFileMock.mockRejectedValue(new Error('Repository not found'))

      const elevated = useSystemIdentityContext({ injector })
      const result = await ValidateRepoAction(
        createMockActionContext({ injector: elevated, urlParams: { id: 'repo-2' } }),
      )
      await elevated[Symbol.asyncDispose]()

      const body = result.chunk as { accessible: boolean; message?: string }
      expect(body.accessible).toBe(false)
      expect(body.message).toContain('Repository not found')
    })
  })

  it('should throw 404 when repository does not exist', () => {
    const { injector } = createSetup()
    return usingAsync(injector, async () => {
      const elevated = useSystemIdentityContext({ injector })
      await expect(
        ValidateRepoAction(createMockActionContext({ injector: elevated, urlParams: { id: 'nonexistent' } })),
      ).rejects.toThrow('Repository not found')
      await elevated[Symbol.asyncDispose]()
    })
  })
})
