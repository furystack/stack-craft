import { ApiTokenDataSet, PublicApiTokenDataSet } from '../data-store/tokens.js'
import { getDataSetFor } from '@furystack/repository'
import { getCurrentUser } from '@furystack/core'
import type { Injector } from '@furystack/inject'
import { getLogger } from '@furystack/logging'
import { RequestError } from '@furystack/rest'
import { JsonResult, type RequestAction, useRestService, Validate } from '@furystack/rest-service'
import type { CreateTokenEndpoint, TokensApi } from 'common'
import { ApiToken, PublicApiToken } from 'common'
import tokensApiSchema from 'common/schemas/tokens-api.json' with { type: 'json' }
import { randomBytes, createHash } from 'crypto'

import { useSystemIdentityContext } from '@furystack/core'
import { getCorsOptions } from '../../get-cors-options.js'
import { getHost } from '../../get-host.js'
import { getPort } from '../../get-port.js'
import { legacyRepository as getRepository } from '../../utils/legacy-repository.js'

export const CreateTokenAction: RequestAction<CreateTokenEndpoint> = async ({ injector, getBody }) => {
  const logger = getLogger(injector).withScope('CreateToken')
  const currentUser = await getCurrentUser(injector)

  if (!currentUser) {
    throw new RequestError('Not authenticated', 401)
  }

  const { name } = await getBody()
  const plainTextToken = randomBytes(32).toString('hex')
  const tokenHash = createHash('sha256').update(plainTextToken).digest('hex')

  const now = new Date().toISOString()
  const id = randomBytes(16).toString('hex')

  const tokenEntity: ApiToken = {
    id,
    username: currentUser.username,
    name,
    tokenHash,
    createdAt: now,
  }

  const apiTokenDs = getDataSetFor(injector, ApiTokenDataSet)
  await apiTokenDs.add(injector, tokenEntity)

  const { tokenHash: _hash, ...publicToken } = tokenEntity
  const publicTokenDs = getDataSetFor(injector, PublicApiTokenDataSet)
  await publicTokenDs.add(injector, publicToken)

  await logger.information({ message: `Token created: ${name} for user ${currentUser.username}` })

  return JsonResult({ token: publicToken, plainTextToken })
}

export const GetTokensAction: RequestAction<TokensApi['GET']['/tokens']> = async ({ injector }) => {
  const currentUser = await getCurrentUser(injector)

  if (!currentUser) {
    throw new RequestError('Not authenticated', 401)
  }

  const apiTokenDs = getDataSetFor(injector, ApiTokenDataSet)
  const tokens = await apiTokenDs.find(injector, {
    filter: { username: { $eq: currentUser.username } },
  })

  const publicTokens = tokens.map(({ tokenHash: _hash, ...rest }) => rest)
  return JsonResult({ count: publicTokens.length, entries: publicTokens })
}

export const DeleteTokenAction: RequestAction<TokensApi['DELETE']['/tokens/:id']> = async ({
  injector,
  getUrlParams,
}) => {
  const currentUser = await getCurrentUser(injector)

  if (!currentUser) {
    throw new RequestError('Not authenticated', 401)
  }

  const { id } = getUrlParams()
  const apiTokenDs = getDataSetFor(injector, ApiTokenDataSet)

  const results = await apiTokenDs.find(injector, { filter: { id: { $eq: id } }, top: 1 })
  const token = results[0]

  if (!token || token.username !== currentUser.username) {
    throw new RequestError('Token not found', 404)
  }

  await apiTokenDs.remove(injector, id)
  const publicTokenDs = getDataSetFor(injector, PublicApiTokenDataSet)
  await publicTokenDs.remove(injector, id)
  return JsonResult({})
}

const populatePublicTokenStore = async (injector: Injector) => {
  const elevated = useSystemIdentityContext({ injector })
  try {
    const repository = getRepository(elevated)
    const allTokens = await repository.getDataSetFor(ApiToken, 'id').find(elevated, {})
    const publicTokenDs = repository.getDataSetFor(PublicApiToken, 'id')

    const publicTokens = allTokens.map(({ tokenHash: _hash, ...rest }) => rest)
    for (const token of publicTokens) {
      await publicTokenDs.add(elevated, token)
    }
  } finally {
    await elevated[Symbol.asyncDispose]()
  }
}

export const setupTokensRestApi = async (injector: Injector) => {
  await populatePublicTokenStore(injector)

  await useRestService<TokensApi>({
    injector,
    root: 'api/tokens',
    hostName: getHost(),
    port: getPort(),
    cors: getCorsOptions(),
    api: {
      GET: {
        '/tokens': Validate({ schema: tokensApiSchema, schemaName: 'GetCollectionEndpoint<PublicApiToken>' })(
          GetTokensAction,
        ),
      },
      POST: {
        '/tokens': Validate({ schema: tokensApiSchema, schemaName: 'CreateTokenEndpoint' })(CreateTokenAction),
      },
      DELETE: {
        '/tokens/:id': Validate({ schema: tokensApiSchema, schemaName: 'DeleteEndpoint<ApiToken,"id">' })(
          DeleteTokenAction,
        ),
      },
    },
  })
}
