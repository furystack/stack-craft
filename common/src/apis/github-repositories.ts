import type { WithOptionalId } from '@furystack/core'
import type {
  DeleteEndpoint,
  GetCollectionEndpoint,
  GetEntityEndpoint,
  PatchEndpoint,
  RestApi,
} from '@furystack/rest'
import type { GitHubRepository } from '../models/github-repository.js'

export type GitHubRepoWritableFields = Omit<GitHubRepository, 'createdAt' | 'updatedAt'>

export type PostGitHubRepoEndpoint = {
  result: GitHubRepository
  body: WithOptionalId<GitHubRepoWritableFields, 'id'>
}

export type PatchGitHubRepoEndpoint = PatchEndpoint<GitHubRepoWritableFields, 'id'>

export type ValidateRepoEndpoint = {
  url: { id: string }
  result: { accessible: boolean; message?: string }
}

export interface GitHubRepositoriesApi extends RestApi {
  GET: {
    '/github-repositories': GetCollectionEndpoint<GitHubRepository>
    '/github-repositories/:id': GetEntityEndpoint<GitHubRepository, 'id'>
  }
  POST: {
    '/github-repositories': PostGitHubRepoEndpoint
    '/github-repositories/:id/validate': ValidateRepoEndpoint
  }
  PATCH: {
    '/github-repositories/:id': PatchGitHubRepoEndpoint
  }
  DELETE: {
    '/github-repositories/:id': DeleteEndpoint<GitHubRepository, 'id'>
  }
}
