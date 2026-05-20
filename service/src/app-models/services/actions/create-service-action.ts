import type { Injector } from '@furystack/inject'
import { RequestError } from '@furystack/rest'
import { JsonResult, type RequestAction } from '@furystack/rest-service'
import type { PostServiceEndpoint } from 'common'
import { ServiceDefinition } from 'common'

import { CryptoService } from '../../../utils/crypto-service.js'
import { legacyRepository as getRepository } from '../../../utils/legacy-repository.js'
import { buildMaskedServiceView, buildServiceArtifacts } from './service-artifacts.js'
import { createServiceWithRollback } from './service-create-with-rollback.js'

const assertNoServiceIdCollision = async (injector: Injector, id: string | undefined): Promise<void> => {
  if (id === undefined) return
  const ds = getRepository(injector).getDataSetFor(ServiceDefinition, 'id')
  const existing = await ds.get(injector, id)
  if (existing) {
    throw new RequestError(`A service with id "${id}" already exists. Choose a different id.`, 409)
  }
}

/**
 * POST action that creates a {@link ServiceDefinition} along with its
 * companion `ServiceConfig`, `ServiceStatus` and the requested prerequisite /
 * dependency link rows.
 *
 * Rejects with `409 Conflict` when the client-supplied `body.id` matches an
 * existing service. If any later insert throws, every record written for the
 * service is removed before the error propagates (see
 * {@link createServiceWithRollback}).
 */
export const CreateServiceAction: RequestAction<PostServiceEndpoint> = async ({ injector, getBody }) => {
  const body = await getBody()
  const crypto = injector.get(CryptoService)
  const now = new Date().toISOString()

  await assertNoServiceIdCollision(injector, body.id)
  const artifacts = buildServiceArtifacts(body, crypto, now)
  await createServiceWithRollback(injector, artifacts)
  return JsonResult(buildMaskedServiceView(artifacts, crypto))
}
