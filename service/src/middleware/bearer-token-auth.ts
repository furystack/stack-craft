import { getStoreManager } from '@furystack/core'
import type { Injector } from '@furystack/inject'
import { getLogger } from '@furystack/logging'
import { ApiToken, User } from 'common'
import { createHash } from 'crypto'

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

  const sm = getStoreManager(injector)
  const tokenStore = sm.getStoreFor(ApiToken, 'id')

  const tokens = await tokenStore.find({ filter: { tokenHash: { $eq: tokenHash } }, top: 1 })
  const token = tokens[0]

  if (!token) {
    return null
  }

  const logger = getLogger(injector).withScope('BearerTokenAuth')
  await logger.verbose({ message: `Token authenticated: ${token.name} for user ${token.username}` })

  await tokenStore.update(token.id, { lastUsedAt: new Date().toISOString() } as Partial<ApiToken>)

  const userStore = sm.getStoreFor(User, 'username')
  const users = await userStore.find({ filter: { username: { $eq: token.username } }, top: 1 })
  return users[0] ?? null
}
