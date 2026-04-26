import { ServiceDefinitionDataSet } from '../app-models/data-store/tokens.js'
import { getDataSetFor } from '@furystack/repository'
import type { Injector } from '@furystack/inject'
import type { ServiceDefinition } from 'common'

import { NotFoundError } from './domain-error.js'
export const getServiceOrThrow = async (serviceId: string, elevated: Injector): Promise<ServiceDefinition> => {
  const services = await getDataSetFor(elevated, ServiceDefinitionDataSet).find(elevated, {
    filter: { id: { $eq: serviceId } },
    top: 1,
  })
  const service = services[0]
  if (!service) throw new NotFoundError(`Service not found: ${serviceId}`)
  return service
}
