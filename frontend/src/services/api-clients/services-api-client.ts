import { Injectable } from '@furystack/inject'
import { createClient } from '@furystack/rest-client-fetch'
import type { ServicesApi } from 'common'
import { environmentOptions } from '../../environment-options.js'

@Injectable({ lifetime: 'singleton' })
export class ServicesApiClient {
  public call = createClient<ServicesApi>({
    endpointUrl: `${environmentOptions.serviceUrl}/services`,
    requestInit: {
      credentials: 'include',
      mode: 'cors',
    },
  })
}
