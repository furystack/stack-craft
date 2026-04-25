import { defineService, type Token } from '@furystack/inject'
import { createClient } from '@furystack/rest-client-fetch'
import type { PrerequisitesApi } from 'common'
import { environmentOptions } from '../../environment-options.js'

class PrerequisitesApiClientImpl {
  public call = createClient<PrerequisitesApi>({
    endpointUrl: `${environmentOptions.serviceUrl}/prerequisites`,
    requestInit: {
      credentials: 'include',
      mode: 'cors',
    },
  })
}

export type PrerequisitesApiClient = PrerequisitesApiClientImpl

export const PrerequisitesApiClient: Token<PrerequisitesApiClient, 'singleton'> = defineService({
  name: 'app/PrerequisitesApiClient',
  lifetime: 'singleton',
  factory: () => new PrerequisitesApiClientImpl(),
})
