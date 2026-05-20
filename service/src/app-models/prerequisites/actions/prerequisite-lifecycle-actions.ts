import type { WithOptionalId } from '@furystack/core'
import type { DeleteEndpoint } from '@furystack/rest'
import { RequestError } from '@furystack/rest'
import { JsonResult, readPostBody, type RequestAction } from '@furystack/rest-service'
import type { PostPrerequisiteEndpoint, PrerequisiteWritableFields } from 'common'
import { Prerequisite, PrerequisiteCheckResult } from 'common'
import { legacyRepository as getRepository } from '../../../utils/legacy-repository.js'

/**
 * POST action that creates a Prerequisite and seeds an 'unchecked'
 * {@link PrerequisiteCheckResult} entry for it.
 */
export const CreatePrerequisiteAction: RequestAction<PostPrerequisiteEndpoint> = async ({ injector, request }) => {
  const repository = getRepository(injector)
  const prereqDs = repository.getDataSetFor<Prerequisite, 'id', WithOptionalId<PrerequisiteWritableFields, 'id'>>(
    Prerequisite,
    'id',
  )
  const checkResultDs = repository.getDataSetFor(PrerequisiteCheckResult, 'prerequisiteId')

  const body = await readPostBody<WithOptionalId<PrerequisiteWritableFields, 'id'>>(request)

  if (body.id !== undefined) {
    const existing = await prereqDs.get(injector, body.id)
    if (existing) {
      throw new RequestError(`A prerequisite with id "${body.id}" already exists. Choose a different id.`, 409)
    }
  }

  const { created } = await prereqDs.add(injector, body)
  if (!created?.length) {
    throw new RequestError('Prerequisite not created', 500)
  }

  const newPrereq = created[0]
  try {
    await checkResultDs.add(injector, {
      prerequisiteId: newPrereq.id,
      status: 'unchecked',
      output: '',
      checkedAt: '',
    })
  } catch (error) {
    await prereqDs.remove(injector, newPrereq.id).catch(() => undefined)
    throw error instanceof RequestError
      ? error
      : new RequestError(
          `Failed to create prerequisite: ${error instanceof Error ? error.message : 'unknown error'}`,
          500,
        )
  }

  return JsonResult(newPrereq, 201)
}

/**
 * DELETE action that removes a Prerequisite and its corresponding
 * {@link PrerequisiteCheckResult} entry.
 */
export const DeletePrerequisiteAction: RequestAction<DeleteEndpoint<Prerequisite, 'id'>> = async ({
  injector,
  getUrlParams,
}) => {
  const { id } = getUrlParams()
  const repository = getRepository(injector)

  const checkResultDs = repository.getDataSetFor(PrerequisiteCheckResult, 'prerequisiteId')
  const existing = await checkResultDs.find(injector, { filter: { prerequisiteId: { $eq: id } }, top: 1 })
  if (existing.length > 0) {
    await checkResultDs.remove(injector, id)
  }

  const prereqDs = repository.getDataSetFor(Prerequisite, 'id')
  await prereqDs.remove(injector, id)

  return JsonResult({}, 204)
}
