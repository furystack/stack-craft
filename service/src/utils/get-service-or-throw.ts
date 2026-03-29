import type { Injector } from '@furystack/inject'
import { getRepository } from '@furystack/repository'
import { ServiceDefinition } from 'common'

import { NotFoundError } from './domain-error.js'

export const getServiceOrThrow = async (serviceId: string, elevated: Injector): Promise<ServiceDefinition> => {
  const services = await getRepository(elevated)
    .getDataSetFor(ServiceDefinition, 'id')
    .find(elevated, { filter: { id: { $eq: serviceId } }, top: 1 })
  const service = services[0]
  if (!service) throw new NotFoundError(`Service not found: ${serviceId}`)
  return service
}
