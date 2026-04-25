import { defineService, type Token } from '@furystack/inject'
import { createClient } from '@furystack/rest-client-fetch'
import type { ServicesApi } from 'common'
import { environmentOptions } from '../../environment-options.js'

class ServicesApiClientImpl {
  public call = createClient<ServicesApi>({
    endpointUrl: `${environmentOptions.serviceUrl}/services`,
    requestInit: {
      credentials: 'include',
      mode: 'cors',
    },
  })
}

export type ServicesApiClient = ServicesApiClientImpl

export const ServicesApiClient: Token<ServicesApiClient, 'singleton'> = defineService({
  name: 'app/ServicesApiClient',
  lifetime: 'singleton',
  factory: () => new ServicesApiClientImpl(),
})
