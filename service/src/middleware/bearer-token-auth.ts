import type { Injector } from '@furystack/inject'
import { getLogger } from '@furystack/logging'
import { getRepository } from '@furystack/repository'
import { ApiToken, User } from 'common'
import { createHash } from 'crypto'

import { useSystemIdentityContext } from '@furystack/core'

/**
 * Extracts a Bearer token from the Authorization header,
 * looks up the matching ApiToken, and returns the associated user.
 * Returns null if no token or token not found.
 */
export const resolveTokenUser = async (injector: Injector, authHeader: string | undefined): Promise<User | null> => {
  if (!authHeader?.startsWith('Bearer ')) {
    return null
  }

  const plainToken = authHeader.slice(7)
  const tokenHash = createHash('sha256').update(plainToken).digest('hex')

  const elevated = useSystemIdentityContext({ injector })
  try {
    const repository = getRepository(elevated)
    const tokenDs = repository.getDataSetFor(ApiToken, 'id')

    const tokens = await tokenDs.find(elevated, { filter: { tokenHash: { $eq: tokenHash } }, top: 1 })
    const token = tokens[0]

    if (!token) {
      return null
    }

    const logger = getLogger(injector).withScope('BearerTokenAuth')
    await logger.verbose({ message: `Token authenticated: ${token.name} for user ${token.username}` })

    await tokenDs.update(elevated, token.id, { lastUsedAt: new Date().toISOString() } as Partial<ApiToken>)

    const userDs = repository.getDataSetFor(User, 'username')
    const users = await userDs.find(elevated, { filter: { username: { $eq: token.username } }, top: 1 })
    return users[0] ?? null
  } finally {
    await elevated[Symbol.asyncDispose]()
  }
}
