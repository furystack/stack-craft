import { Injectable } from '@furystack/inject'
import { createClient } from '@furystack/rest-client-fetch'
import type { StacksApi } from 'common'
import { environmentOptions } from '../../environment-options.js'

@Injectable({ lifetime: 'singleton' })
export class StacksApiClient {
  public call = createClient<StacksApi>({
    endpointUrl: `${environmentOptions.serviceUrl}/stacks`,
    requestInit: {
      credentials: 'include',
      mode: 'cors',
    },
  })
}
