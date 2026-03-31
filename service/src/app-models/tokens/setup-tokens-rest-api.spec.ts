import { addStore, getCurrentUser, InMemoryStore, useSystemIdentityContext } from '@furystack/core'
import { Injector } from '@furystack/inject'
import { useLogging, VerboseConsoleLogger } from '@furystack/logging'
import { getRepository } from '@furystack/repository'
import { usingAsync } from '@furystack/utils'
import { ApiToken, PublicApiToken, type User } from 'common'
import { createHash } from 'crypto'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { CreateTokenAction, DeleteTokenAction, GetTokensAction } from './setup-tokens-rest-api.js'

vi.mock('@furystack/core', async (importOriginal) => {
  // eslint-disable-next-line @typescript-eslint/consistent-type-imports
  const actual = await importOriginal<typeof import('@furystack/core')>()
  return {
    ...actual,
    getCurrentUser: vi.fn(),
  }
})

const createMockActionContext = <TBody = unknown, TUrl = Record<string, string>>(options: {
  injector: Injector
  body?: TBody
  urlParams?: TUrl
}) => ({
  injector: options.injector,
  getBody: () => Promise.resolve(options.body as TBody),
  getUrlParams: () => (options.urlParams ?? {}) as TUrl,
  getQuery: () => ({}) as never,
  request: {} as never,
  response: {} as never,
})

const createSetup = () => {
  const injector = new Injector()
  useLogging(injector, VerboseConsoleLogger)
  addStore(injector, new InMemoryStore({ model: ApiToken, primaryKey: 'id' }))
  addStore(injector, new InMemoryStore({ model: PublicApiToken, primaryKey: 'id' }))
  getRepository(injector).createDataSet(ApiToken, 'id', {})
  getRepository(injector).createDataSet(PublicApiToken, 'id', {})
  return injector
}

describe('Token CRUD operations', () => {
  const mockedGetCurrentUser = vi.mocked(getCurrentUser)

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('CreateTokenAction', () => {
    it('should create a token and return plainTextToken', () =>
      usingAsync(createSetup(), async (injector) => {
        mockedGetCurrentUser.mockResolvedValue({ username: 'admin', roles: ['admin'] })

        const actionResult = await CreateTokenAction(createMockActionContext({ injector, body: { name: 'my-token' } }))

        const result = actionResult.chunk as { token: PublicApiToken; plainTextToken: string }
        expect(result.plainTextToken).toBeDefined()
        expect(result.plainTextToken.length).toBe(64)
        expect(result.token.name).toBe('my-token')
        expect(result.token.username).toBe('admin')
        expect(result.token).not.toHaveProperty('tokenHash')

        const elevated = useSystemIdentityContext({ injector })
        const stored = await getRepository(elevated).getDataSetFor(ApiToken, 'id').find(elevated, {})
        await elevated[Symbol.asyncDispose]()

        expect(stored).toHaveLength(1)
        const expectedHash = createHash('sha256').update(result.plainTextToken).digest('hex')
        expect(stored[0]?.tokenHash).toBe(expectedHash)
      }))

    it('should throw 401 when not authenticated', () =>
      usingAsync(createSetup(), async (injector) => {
        mockedGetCurrentUser.mockResolvedValue(null as unknown as User)

        await expect(
          CreateTokenAction(createMockActionContext({ injector, body: { name: 'my-token' } })),
        ).rejects.toThrow('Not authenticated')
      }))
  })

  describe('GetTokensAction', () => {
    it('should return only tokens belonging to the current user', () =>
      usingAsync(createSetup(), async (injector) => {
        mockedGetCurrentUser.mockResolvedValue({ username: 'admin', roles: ['admin'] })

        const elevated = useSystemIdentityContext({ injector })
        const tokenDs = getRepository(elevated).getDataSetFor(ApiToken, 'id')
        await tokenDs.add(
          elevated,
          {
            id: 'tok-1',
            username: 'admin',
            name: 'Admin Token',
            tokenHash: 'hash1',
            createdAt: new Date().toISOString(),
          },
          {
            id: 'tok-2',
            username: 'other-user',
            name: 'Other Token',
            tokenHash: 'hash2',
            createdAt: new Date().toISOString(),
          },
        )
        await elevated[Symbol.asyncDispose]()

        const actionResult = await GetTokensAction(createMockActionContext({ injector }))
        const result = actionResult.chunk as { count: number; entries: PublicApiToken[] }

        expect(result.count).toBe(1)
        expect(result.entries[0]?.name).toBe('Admin Token')
      }))
  })

  describe('DeleteTokenAction', () => {
    it('should delete a token owned by the current user', () =>
      usingAsync(createSetup(), async (injector) => {
        mockedGetCurrentUser.mockResolvedValue({ username: 'admin', roles: ['admin'] })

        const elevated = useSystemIdentityContext({ injector })
        await getRepository(elevated).getDataSetFor(ApiToken, 'id').add(elevated, {
          id: 'tok-del',
          username: 'admin',
          name: 'Delete Me',
          tokenHash: 'hash',
          createdAt: new Date().toISOString(),
        })
        await getRepository(elevated).getDataSetFor(PublicApiToken, 'id').add(elevated, {
          id: 'tok-del',
          username: 'admin',
          name: 'Delete Me',
          createdAt: new Date().toISOString(),
        })
        await elevated[Symbol.asyncDispose]()

        await DeleteTokenAction(createMockActionContext({ injector, urlParams: { id: 'tok-del' } }))

        const elevated2 = useSystemIdentityContext({ injector })
        const remaining = await getRepository(elevated2).getDataSetFor(ApiToken, 'id').find(elevated2, {})
        await elevated2[Symbol.asyncDispose]()
        expect(remaining).toHaveLength(0)
      }))

    it("should throw 404 when deleting another user's token", () =>
      usingAsync(createSetup(), async (injector) => {
        mockedGetCurrentUser.mockResolvedValue({ username: 'admin', roles: ['admin'] })

        const elevated = useSystemIdentityContext({ injector })
        await getRepository(elevated).getDataSetFor(ApiToken, 'id').add(elevated, {
          id: 'tok-other',
          username: 'other-user',
          name: 'Other Token',
          tokenHash: 'hash',
          createdAt: new Date().toISOString(),
        })
        await elevated[Symbol.asyncDispose]()

        await expect(
          DeleteTokenAction(createMockActionContext({ injector, urlParams: { id: 'tok-other' } })),
        ).rejects.toThrow('Token not found')
      }))
  })
})
