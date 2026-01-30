import { Injectable } from '@furystack/inject'
import { createClient } from '@furystack/rest-client-fetch'
import type { BoilerplateApi } from 'common'
import { environmentOptions } from '../environment-options.js'

@Injectable({ lifetime: 'singleton' })
export class BoilerplateApiClient {
  public call = createClient<BoilerplateApi>({
    endpointUrl: environmentOptions.serviceUrl,
    requestInit: {
      credentials: 'include',
      mode: 'cors',
    },
  })
}
