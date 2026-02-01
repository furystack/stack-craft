import { Injectable } from '@furystack/inject'
import { createClient } from '@furystack/rest-client-fetch'
import type { StackCraftApi } from 'common'
import { environmentOptions } from '../environment-options.js'

@Injectable({ lifetime: 'singleton' })
export class StackCraftApiClient {
  public call = createClient<StackCraftApi>({
    endpointUrl: environmentOptions.serviceUrl,
    requestInit: {
      credentials: 'include',
      mode: 'cors',
    },
  })
}
