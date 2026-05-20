import type { WithOptionalId } from '@furystack/core'
import type { Injector } from '@furystack/inject'
import '@furystack/repository'
import { RequestError } from '@furystack/rest'
import {
  createDeleteEndpoint,
  createGetCollectionEndpoint,
  createGetEntityEndpoint,
  createPatchEndpoint,
  JsonResult,
  useRestService,
  Validate,
} from '@furystack/rest-service'
import type { GitHubRepoWritableFields, GitHubRepositoriesApi } from 'common'
import { GitHubRepository } from 'common'
import githubReposApiSchema from 'common/schemas/github-repositories-api.json' with { type: 'json' }

import { GitHubRepositoryDataSet } from '../data-store/tokens.js'
import { getCorsOptions } from '../../get-cors-options.js'
import { getHost } from '../../get-host.js'
import { getPort } from '../../get-port.js'
import { legacyRepository as getRepository } from '../../utils/legacy-repository.js'
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
        })(async ({ injector: i, getBody }) => {
          const body = await getBody()
          const ds = getRepository(i).getDataSetFor<
            GitHubRepository,
            'id',
            WithOptionalId<GitHubRepoWritableFields, 'id'>
          >(GitHubRepository, 'id')
          if (body.id !== undefined) {
            const existing = await ds.get(i, body.id)
            if (existing) {
              throw new RequestError(
                `A GitHub repository with id "${body.id}" already exists. Choose a different id.`,
                409,
              )
            }
          }
          const { created } = await ds.add(i, body)
          if (!created?.length) {
            throw new RequestError('Repository not created', 500)
          }
          return JsonResult(created[0], 201)
        }),
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
