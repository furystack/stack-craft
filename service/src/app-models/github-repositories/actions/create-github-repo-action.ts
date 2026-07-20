import type { WithOptionalId } from '@furystack/core'
import { RequestError } from '@furystack/rest'
import { JsonResult, type RequestAction } from '@furystack/rest-service'
import type { GitHubRepoWritableFields, PostGitHubRepoEndpoint } from 'common'
import { GitHubRepository } from 'common'

import { legacyRepository as getRepository } from '../../../utils/legacy-repository.js'

/**
 * POST action that registers a new {@link GitHubRepository}.
 *
 * Rejects with `409 Conflict` when the client-supplied `body.id` matches an
 * existing record, so the store-level `add` cannot silently overwrite it.
 */
export const CreateGitHubRepoAction: RequestAction<PostGitHubRepoEndpoint> = async ({ injector, getBody }) => {
  const body = await getBody()
  const ds = getRepository(injector).getDataSetFor<
    GitHubRepository,
    'id',
    WithOptionalId<GitHubRepoWritableFields, 'id'>
  >(GitHubRepository, 'id')

  if (body.id !== undefined) {
    const existing = await ds.get(injector, body.id)
    if (existing) {
      throw new RequestError(`A GitHub repository with id "${body.id}" already exists. Choose a different id.`, 409)
    }
  }

  const { created } = await ds.add(injector, body)
  if (!created?.length) {
    throw new RequestError('Repository not created', 500)
  }
  return JsonResult(created[0], 201)
}
