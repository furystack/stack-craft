import { defineService, type Token } from '@furystack/inject'
import { createClient } from '@furystack/rest-client-fetch'
import type { TokensApi } from 'common'
import { environmentOptions } from '../../environment-options.js'

class TokensApiClientImpl {
  public call = createClient<TokensApi>({
    endpointUrl: `${environmentOptions.serviceUrl}/tokens`,
    requestInit: {
      credentials: 'include',
      mode: 'cors',
    },
  })
}

export type TokensApiClient = TokensApiClientImpl

export const TokensApiClient: Token<TokensApiClient, 'singleton'> = defineService({
  name: 'app/TokensApiClient',
  lifetime: 'singleton',
  factory: () => new TokensApiClientImpl(),
})
