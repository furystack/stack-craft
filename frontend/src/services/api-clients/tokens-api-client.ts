import { Injectable } from '@furystack/inject'
import { createClient } from '@furystack/rest-client-fetch'
import type { TokensApi } from 'common'
import { environmentOptions } from '../../environment-options.js'

@Injectable({ lifetime: 'singleton' })
export class TokensApiClient {
  public call = createClient<TokensApi>({
    endpointUrl: `${environmentOptions.serviceUrl}/tokens`,
    requestInit: {
      credentials: 'include',
      mode: 'cors',
    },
  })
}
