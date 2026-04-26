import { PublicApiTokenDataSet } from './app-models/data-store/tokens.js'
import { IdentityContext } from '@furystack/core'
import { createInjector, Injector } from '@furystack/inject'
import { describe, expect, it } from 'vitest'

import { authorizedOnly, injector } from './config.js'

describe('Config', () => {
  it('should create an injector instance', () => {
    expect(injector).toBeInstanceOf(Injector)
  })

  it('should expose the PublicApiToken dataset token', () => {
    expect(PublicApiTokenDataSet.model).toBeDefined()
  })

  it('authorizedOnly should reject unauthenticated requests', async () => {
    const testInjector = createInjector()
    const ctx: IdentityContext = {
      isAuthenticated: () => Promise.resolve(false),
      isAuthorized: () => Promise.resolve(false),
      getCurrentUser: () => Promise.reject(new Error('not authenticated')),
    }
    testInjector.bind(IdentityContext, () => ctx)
    const result = await authorizedOnly({ injector: testInjector })
    expect(result.isAllowed).toBe(false)
  })
})
