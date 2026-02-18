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
import { GitHubRepository } from 'common'
import githubReposApiSchema from 'common/schemas/github-repositories-api.json' with { type: 'json' }

import { getCorsOptions } from '../../get-cors-options.js'
import { getPort } from '../../get-port.js'
import { ValidateRepoAction } from './actions/validate-repo-action.js'

export const setupGitHubReposRestApi = async (injector: Injector) => {
  await useRestService<GitHubRepositoriesApi>({
    injector,
    root: 'api/github-repositories',
    port: getPort(),
    cors: getCorsOptions(),
    api: {
      GET: {
        '/github-repositories': Validate({
          schema: githubReposApiSchema,
          schemaName: 'GetCollectionEndpoint<GitHubRepository>',
        })(createGetCollectionEndpoint({ model: GitHubRepository, primaryKey: 'id' })),
        '/github-repositories/:id': Validate({
          schema: githubReposApiSchema,
          schemaName: 'GetEntityEndpoint<GitHubRepository,"id">',
        })(createGetEntityEndpoint({ model: GitHubRepository, primaryKey: 'id' })),
      },
      POST: {
        '/github-repositories': Validate({
          schema: githubReposApiSchema,
          schemaName: 'PostGitHubRepoEndpoint',
        })(createPostEndpoint({ model: GitHubRepository, primaryKey: 'id' })),
        '/github-repositories/:id/validate': Validate({
          schema: githubReposApiSchema,
          schemaName: 'ValidateRepoEndpoint',
        })(ValidateRepoAction),
      },
      PATCH: {
        '/github-repositories/:id': Validate({
          schema: githubReposApiSchema,
          schemaName: 'PatchGitHubRepoEndpoint',
        })(createPatchEndpoint({ model: GitHubRepository, primaryKey: 'id' })),
      },
      DELETE: {
        '/github-repositories/:id': createDeleteEndpoint({ model: GitHubRepository, primaryKey: 'id' }),
      },
    },
  })
}
