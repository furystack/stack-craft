import { RequestError } from '@furystack/rest'
import { JsonResult, type RequestAction } from '@furystack/rest-service'
import type { ServiceHistoryEndpoint } from 'common'
import { ServiceDefinition, ServiceStateHistory } from 'common'
import { legacyRepository as getRepository } from '../../../utils/legacy-repository.js'

export const ServiceHistoryAction: RequestAction<ServiceHistoryEndpoint> = async ({
  injector,
  getUrlParams,
  getQuery,
}) => {
  const { id: serviceId } = getUrlParams()
  const query = getQuery()
  const repository = getRepository(injector)

  const svcDefs = await repository
    .getDataSetFor(ServiceDefinition, 'id')
    .find(injector, { filter: { id: { $eq: serviceId } }, top: 1 })
  if (!svcDefs[0]) {
    throw new RequestError('Service not found', 404)
  }

  const entries = await repository.getDataSetFor(ServiceStateHistory, 'id').find(injector, {
    filter: { serviceId: { $eq: serviceId } },
    order: { id: 'DESC' },
    top: query.limit ?? 100,
  })

  return JsonResult({ entries })
}
