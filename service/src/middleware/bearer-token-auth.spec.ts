import { addStore, InMemoryStore } from '@furystack/core'
import { Injector } from '@furystack/inject'
import { useLogging, VerboseConsoleLogger } from '@furystack/logging'
import { ApiToken, User } from 'common'
import { createHash } from 'crypto'
import { describe, expect, it } from 'vitest'
import { resolveTokenUser } from './bearer-token-auth.js'

const setupInjector = () => {
  const injector = new Injector()
  useLogging(injector, VerboseConsoleLogger)
  addStore(injector, new InMemoryStore({ model: ApiToken, primaryKey: 'id' }))
  addStore(injector, new InMemoryStore({ model: User, primaryKey: 'username' }))
  return injector
}

describe('resolveTokenUser', () => {
  it('should return null when no auth header is provided', async () => {
    const injector = setupInjector()
    const result = await resolveTokenUser(injector, undefined)
    expect(result).toBeNull()
  })

  it('should return null when auth header does not start with Bearer', async () => {
    const injector = setupInjector()
    const result = await resolveTokenUser(injector, 'Basic abc123')
    expect(result).toBeNull()
  })

  it('should return null when token is not found in store', async () => {
    const injector = setupInjector()
    const result = await resolveTokenUser(injector, 'Bearer nonexistenttoken')
    expect(result).toBeNull()
  })

  it('should return the user when a valid token is provided', async () => {
    const injector = setupInjector()

    const plainToken = 'test-token-12345'
    const tokenHash = createHash('sha256').update(plainToken).digest('hex')

    const { getStoreManager } = await import('@furystack/core')
    const sm = getStoreManager(injector)

    await sm.getStoreFor(User, 'username').add({ username: 'admin', roles: ['admin'] })
    await sm.getStoreFor(ApiToken, 'id').add({
      id: 'token-1',
      username: 'admin',
      name: 'test-token',
      tokenHash,
      createdAt: new Date().toISOString(),
    })

    const result = await resolveTokenUser(injector, `Bearer ${plainToken}`)
    expect(result).not.toBeNull()
    expect(result?.username).toBe('admin')
  })

  it('should return null when token exists but user does not', async () => {
    const injector = setupInjector()

    const plainToken = 'orphan-token'
    const tokenHash = createHash('sha256').update(plainToken).digest('hex')

    const { getStoreManager } = await import('@furystack/core')
    const sm = getStoreManager(injector)

    await sm.getStoreFor(ApiToken, 'id').add({
      id: 'token-2',
      username: 'deleted-user',
      name: 'orphan',
      tokenHash,
      createdAt: new Date().toISOString(),
    })

    const result = await resolveTokenUser(injector, `Bearer ${plainToken}`)
    expect(result).toBeNull()
  })
})
