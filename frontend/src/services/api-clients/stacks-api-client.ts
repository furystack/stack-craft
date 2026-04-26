import { defineService, type Token } from '@furystack/inject'
import { createClient } from '@furystack/rest-client-fetch'
import type { StacksApi } from 'common'
import { environmentOptions } from '../../environment-options.js'

class StacksApiClientImpl {
  public call = createClient<StacksApi>({
    endpointUrl: `${environmentOptions.serviceUrl}/stacks`,
    requestInit: {
      credentials: 'include',
      mode: 'cors',
    },
  })
}

export type StacksApiClient = StacksApiClientImpl

export const StacksApiClient: Token<StacksApiClient, 'singleton'> = defineService({
  name: 'app/StacksApiClient',
  lifetime: 'singleton',
  factory: () => new StacksApiClientImpl(),
})
