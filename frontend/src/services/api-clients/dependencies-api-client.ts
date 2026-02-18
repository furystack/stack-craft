import { Injectable } from '@furystack/inject'
import { createClient } from '@furystack/rest-client-fetch'
import type { DependenciesApi } from 'common'
import { environmentOptions } from '../../environment-options.js'

@Injectable({ lifetime: 'singleton' })
export class DependenciesApiClient {
  public call = createClient<DependenciesApi>({
    endpointUrl: `${environmentOptions.serviceUrl}/dependencies`,
    requestInit: {
      credentials: 'include',
      mode: 'cors',
    },
  })
}
