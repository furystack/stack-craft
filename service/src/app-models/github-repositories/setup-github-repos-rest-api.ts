import type { Injector } from '@furystack/inject'
import '@furystack/repository'
import {
  createDeleteEndpoint,
  createGetCollectionEndpoint,
  createGetEntityEndpoint,
  createPatchEndpoint,
  createPostEndpoint,
  useRestService,
  Validate,
} from '@furystack/rest-service'
import type { GitHubRepositoriesApi } from 'common'
import githubReposApiSchema from 'common/schemas/github-repositories-api.json' with { type: 'json' }

import { GitHubRepositoryDataSet } from '../data-store/tokens.js'
import { getCorsOptions } from '../../get-cors-options.js'
import { getHost } from '../../get-host.js'
import { getPort } from '../../get-port.js'
import { ValidateRepoAction } from './actions/validate-repo-action.js'

export const setupGitHubReposRestApi = async (injector: Injector) => {
  await useRestService<GitHubRepositoriesApi>({
    injector,
    root: 'api/github-repositories',
    hostName: getHost(),
    port: getPort(),
    cors: getCorsOptions(),
    api: {
      GET: {
        '/github-repositories': Validate({
          schema: githubReposApiSchema,
          schemaName: 'GetCollectionEndpoint<GitHubRepository>',
        })(createGetCollectionEndpoint(GitHubRepositoryDataSet)),
        '/github-repositories/:id': Validate({
          schema: githubReposApiSchema,
          schemaName: 'GetEntityEndpoint<GitHubRepository,"id">',
        })(createGetEntityEndpoint(GitHubRepositoryDataSet)),
      },
      POST: {
        '/github-repositories': Validate({
          schema: githubReposApiSchema,
          schemaName: 'PostGitHubRepoEndpoint',
        })(createPostEndpoint(GitHubRepositoryDataSet)),
        '/github-repositories/:id/validate': Validate({
          schema: githubReposApiSchema,
          schemaName: 'ValidateRepoEndpoint',
        })(ValidateRepoAction),
      },
      PATCH: {
        '/github-repositories/:id': Validate({
          schema: githubReposApiSchema,
          schemaName: 'PatchGitHubRepoEndpoint',
        })(createPatchEndpoint(GitHubRepositoryDataSet)),
      },
      DELETE: {
        '/github-repositories/:id': Validate({
          schema: githubReposApiSchema,
          schemaName: 'DeleteEndpoint<GitHubRepository,"id">',
        })(createDeleteEndpoint(GitHubRepositoryDataSet)),
      },
    },
  })
}
