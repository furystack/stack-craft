import { Injectable } from '@furystack/inject'
import { createClient } from '@furystack/rest-client-fetch'
import type { PrerequisitesApi } from 'common'
import { environmentOptions } from '../../environment-options.js'

@Injectable({ lifetime: 'singleton' })
export class PrerequisitesApiClient {
  public call = createClient<PrerequisitesApi>({
    endpointUrl: `${environmentOptions.serviceUrl}/prerequisites`,
    requestInit: {
      credentials: 'include',
      mode: 'cors',
    },
  })
}
