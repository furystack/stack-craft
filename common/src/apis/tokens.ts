/**
 * REST API type definitions for API token management.
 * Tokens are used to authenticate external clients (e.g. MCP) against the StackCraft API.
 */

import type { DeleteEndpoint, GetCollectionEndpoint, RestApi } from '@furystack/rest'
import type { ApiToken } from '../models/api-token.js'
import type { PublicApiToken } from '../models/public-api-token.js'

/** Creates a new API token and returns the plain-text value (shown only once) */
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
