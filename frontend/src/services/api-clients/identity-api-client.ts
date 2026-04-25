import { defineService, type Token } from '@furystack/inject'
import { createClient } from '@furystack/rest-client-fetch'
import type { IdentityApi } from 'common'
import { environmentOptions } from '../../environment-options.js'

class IdentityApiClientImpl {
  public call = createClient<IdentityApi>({
    endpointUrl: `${environmentOptions.serviceUrl}/identity`,
    requestInit: {
      credentials: 'include',
      mode: 'cors',
    },
  })
}

export type IdentityApiClient = IdentityApiClientImpl

export const IdentityApiClient: Token<IdentityApiClient, 'singleton'> = defineService({
  name: 'app/IdentityApiClient',
  lifetime: 'singleton',
  factory: () => new IdentityApiClientImpl(),
})
