import { Injectable } from '@furystack/inject'
import { createClient } from '@furystack/rest-client-fetch'
import type { SystemApi } from 'common'
import { environmentOptions } from '../../environment-options.js'

@Injectable({ lifetime: 'singleton' })
export class SystemApiClient {
  public call = createClient<SystemApi>({
    endpointUrl: `${environmentOptions.serviceUrl}/system`,
    requestInit: {
      credentials: 'include',
      mode: 'cors',
    },
  })
}
