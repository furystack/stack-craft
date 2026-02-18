import type { DeleteEndpoint, GetCollectionEndpoint, RestApi } from '@furystack/rest'
import type { ApiToken } from '../models/api-token.js'

export type PublicApiToken = Omit<ApiToken, 'tokenHash'>

export type CreateTokenEndpoint = {
  result: { token: PublicApiToken; plainTextToken: string }
  body: { name: string }
}

export interface TokensApi extends RestApi {
  GET: {
    '/tokens': GetCollectionEndpoint<PublicApiToken>
  }
  POST: {
    '/tokens': CreateTokenEndpoint
  }
  DELETE: {
    '/tokens/:id': DeleteEndpoint<ApiToken, 'id'>
  }
}
