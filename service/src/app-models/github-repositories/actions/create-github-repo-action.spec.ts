import { getDataSetFor } from '@furystack/repository'
import { describe, expect, it } from 'vitest'

import { createMockActionContext, withTestInjector } from '../../../test-helpers.js'
import { GitHubRepositoryDataSet } from '../../data-store/tokens.js'
import { CreateGitHubRepoAction } from './create-github-repo-action.js'

type CreateRepoBody = Parameters<typeof CreateGitHubRepoAction>[0] extends { getBody: () => Promise<infer B> }
  ? B
  : never

const baseRepo = {
  id: 'repo-1',
  stackName: 'my-stack',
  url: 'https://github.com/example/repo',
  displayName: 'Example Repo',
  description: '',
}

describe('CreateGitHubRepoAction', () => {
  it('should persist the repository and return it with statusCode 201', async () => {
    await withTestInjector(async ({ elevated }) => {
      const result = await CreateGitHubRepoAction({
        ...createMockActionContext<CreateRepoBody>({ injector: elevated, body: baseRepo }),
        request: {} as never,
      })

      expect(result.statusCode).toBe(201)
      expect(result.chunk.id).toBe('repo-1')

      const stored = await getDataSetFor(elevated, GitHubRepositoryDataSet).find(elevated, {})
      expect(stored).toHaveLength(1)
      expect(stored[0]?.url).toBe('https://github.com/example/repo')
    })
  })

  it('should reject with 409 when a repository with the same id already exists', async () => {
    await withTestInjector(async ({ elevated }) => {
      const ts = new Date().toISOString()
      await getDataSetFor(elevated, GitHubRepositoryDataSet).add(elevated, {
        ...baseRepo,
        displayName: 'Original',
        createdAt: ts,
        updatedAt: ts,
      })

      await expect(
        CreateGitHubRepoAction({
          ...createMockActionContext<CreateRepoBody>({
            injector: elevated,
            body: { ...baseRepo, displayName: 'Duplicate' },
          }),
          request: {} as never,
        }),
      ).rejects.toMatchObject({
        message: expect.stringContaining('"repo-1" already exists'),
        responseCode: 409,
      })

      const stored = await getDataSetFor(elevated, GitHubRepositoryDataSet).find(elevated, {})
      expect(stored).toHaveLength(1)
      expect(stored[0]?.displayName).toBe('Original')
    })
  })
})
