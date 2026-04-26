import { UserDataSet } from '../../data-store/tokens.js'
import { getDataSetFor } from '@furystack/repository'
import { InMemoryStore, useSystemIdentityContext } from '@furystack/core'
import { addStore } from '../../../test-shims.js'
import { Injector } from '@furystack/inject'
import { useLogging, VerboseConsoleLogger } from '@furystack/logging'
import { PasswordCredential, PasswordResetToken, usePasswordPolicy } from '@furystack/security'
import { usingAsync } from '@furystack/utils'
import type { InstallState } from 'common'
import { User } from 'common'
import { describe, expect, it } from 'vitest'

import { GetServiceStatus } from './get-service-status.js'
import { legacyRepository as getRepository } from '../../../utils/legacy-repository.js'

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

const createMockActionContext = (options: { injector: Injector }) => ({
  injector: options.injector,
  getBody: () => Promise.resolve(undefined as never),
  getUrlParams: () => ({}),
  getQuery: () => ({}),
  request: {} as never,
  response: {} as never,
})

describe('GetServiceStatus', () => {
  it('should return "needsInstall" when no users exist', () =>
    usingAsync(setupInjector(), async (injector) => {
      const result = await GetServiceStatus(createMockActionContext({ injector }))
      const body = (result as { chunk: { state: InstallState } }).chunk
      expect(body.state).toBe('needsInstall')
    }))

  it('should return "installed" when users exist', () =>
    usingAsync(setupInjector(), async (injector) => {
      const elevated = useSystemIdentityContext({ injector })
      await getDataSetFor(elevated, UserDataSet).add(elevated, { username: 'admin', roles: [] })
      await elevated[Symbol.asyncDispose]()

      const result = await GetServiceStatus(createMockActionContext({ injector }))
      const body = (result as { chunk: { state: InstallState } }).chunk
      expect(body.state).toBe('installed')
    }))
})
