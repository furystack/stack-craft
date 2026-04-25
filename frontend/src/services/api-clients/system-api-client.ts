import { defineService, type Token } from '@furystack/inject'
import { createClient } from '@furystack/rest-client-fetch'
import type { SystemApi } from 'common'
import { environmentOptions } from '../../environment-options.js'

class SystemApiClientImpl {
  public call = createClient<SystemApi>({
    endpointUrl: `${environmentOptions.serviceUrl}/system`,
    requestInit: {
      credentials: 'include',
      mode: 'cors',
    },
  })
}

export type SystemApiClient = SystemApiClientImpl

export const SystemApiClient: Token<SystemApiClient, 'singleton'> = defineService({
  name: 'app/SystemApiClient',
  lifetime: 'singleton',
  factory: () => new SystemApiClientImpl(),
})
