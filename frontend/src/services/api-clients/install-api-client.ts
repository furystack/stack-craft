import { defineService, type Token } from '@furystack/inject'
import { createClient } from '@furystack/rest-client-fetch'
import type { InstallApi } from 'common'
import { environmentOptions } from '../../environment-options.js'

class InstallApiClientImpl {
  public call = createClient<InstallApi>({
    endpointUrl: `${environmentOptions.serviceUrl}/install`,
    requestInit: {
      credentials: 'include',
      mode: 'cors',
    },
  })
}

export type InstallApiClient = InstallApiClientImpl

export const InstallApiClient: Token<InstallApiClient, 'singleton'> = defineService({
  name: 'app/InstallApiClient',
  lifetime: 'singleton',
  factory: () => new InstallApiClientImpl(),
})
