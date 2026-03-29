import { addStore, InMemoryStore, useSystemIdentityContext } from '@furystack/core'
import { Injector } from '@furystack/inject'
import { useLogging, VerboseConsoleLogger } from '@furystack/logging'
import { getRepository } from '@furystack/repository'
import { PasswordCredential, PasswordResetToken, usePasswordPolicy } from '@furystack/security'
import { User } from 'common'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { PostInstallAction } from './post-install-action.js'

const setupInjector = () => {
  const injector = new Injector()
  useLogging(injector, VerboseConsoleLogger)
  addStore(injector, new InMemoryStore({ model: User, primaryKey: 'username' }))
    .addStore(new InMemoryStore({ model: PasswordCredential, primaryKey: 'userName' }))
    .addStore(new InMemoryStore({ model: PasswordResetToken, primaryKey: 'token' }))
  getRepository(injector).createDataSet(User, 'username', {})
  getRepository(injector).createDataSet(PasswordCredential, 'userName', {})
  getRepository(injector).createDataSet(PasswordResetToken, 'token')
  usePasswordPolicy(injector)
  return injector
}

const createMockActionContext = (options: { injector: Injector; body?: Record<string, unknown> }) => ({
  injector: options.injector,
  getBody: () => Promise.resolve(options.body ?? {}),
  getUrlParams: () => ({}),
  getQuery: () => ({}),
  request: {} as never,
  response: {} as never,
})

describe('PostInstallAction', () => {
  let injector: Injector

  beforeEach(() => {
    injector = setupInjector()
  })

  afterEach(async () => {
    await injector[Symbol.asyncDispose]()
  })

  it('should install the service and return success', async () => {
    const result = await PostInstallAction(
      createMockActionContext({
        injector,
        body: { username: 'admin', password: 'secret123' },
      }) as unknown as Parameters<typeof PostInstallAction>[0],
    )

    expect((result as { chunk: unknown }).chunk).toEqual({ success: true })

    const elevated = useSystemIdentityContext({ injector })
    const users = await getRepository(elevated).getDataSetFor(User, 'username').find(elevated, {})
    await elevated[Symbol.asyncDispose]()

    expect(users).toHaveLength(1)
    expect(users[0].username).toBe('admin')
  })

  it('should throw if service is already installed', async () => {
    await PostInstallAction(
      createMockActionContext({
        injector,
        body: { username: 'admin', password: 'secret123' },
      }) as unknown as Parameters<typeof PostInstallAction>[0],
    )

    await expect(
      PostInstallAction(
        createMockActionContext({
          injector,
          body: { username: 'admin2', password: 'pass' },
        }) as unknown as Parameters<typeof PostInstallAction>[0],
      ),
    ).rejects.toThrow('Service is already installed')
  })
})
