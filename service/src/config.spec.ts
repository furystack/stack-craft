import { Injector } from '@furystack/inject'
import { getRepository } from '@furystack/repository'
import { PublicApiToken } from 'common'
import { describe, expect, it } from 'vitest'

import { authorizedOnly, injector } from './config.js'

describe('Config', () => {
  it('should create an injector instance', () => {
    expect(injector).toBeInstanceOf(Injector)
  })

  it('should register a PublicApiToken dataset', () => {
    const ds = getRepository(injector).getDataSetFor(PublicApiToken, 'id')
    expect(ds).toBeDefined()
  })

  it('authorizedOnly should reject unauthenticated requests', async () => {
    const testInjector = new Injector()
    const result = await authorizedOnly({ injector: testInjector })
    expect(result.isAllowed).toBe(false)
  })
})
