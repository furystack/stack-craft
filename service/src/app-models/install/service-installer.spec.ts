import { addStore, InMemoryStore } from '@furystack/core'
import { Injector } from '@furystack/inject'
import { useLogging, VerboseConsoleLogger } from '@furystack/logging'
import { getRepository } from '@furystack/repository'
import { PasswordAuthenticator, PasswordCredential, usePasswordPolicy } from '@furystack/security'
import { User } from 'common'
import { describe, expect, it } from 'vitest'

import { createElevatedContext } from '../../utils/elevated-context.js'
import { ServiceStatusProvider } from './service-installer.js'

const setupInjector = () => {
  const injector = new Injector()
  useLogging(injector, VerboseConsoleLogger)
  addStore(injector, new InMemoryStore({ model: User, primaryKey: 'username' }))
  addStore(injector, new InMemoryStore({ model: PasswordCredential, primaryKey: 'userName' }))
  getRepository(injector).createDataSet(User, 'username', {})
  getRepository(injector).createDataSet(PasswordCredential, 'userName', {})
  usePasswordPolicy(injector)
  return injector
}

describe('ServiceStatusProvider', () => {
  describe('getStatus', () => {
    it('should return "needsInstall" when no users exist', async () => {
      const injector = setupInjector()
      const provider = injector.getInstance(ServiceStatusProvider)
      const status = await provider.getStatus()
      expect(status).toBe('needsInstall')
    })

    it('should return "installed" when users exist', async () => {
      const injector = setupInjector()
      const elevated = createElevatedContext(injector)
      await getRepository(elevated).getDataSetFor(User, 'username').add(elevated, { username: 'admin', roles: [] })
      await elevated[Symbol.asyncDispose]()

      const provider = injector.getInstance(ServiceStatusProvider)
      const status = await provider.getStatus()
      expect(status).toBe('installed')
    })
  })

  describe('install', () => {
    it('should create a user and password credential', async () => {
      const injector = setupInjector()
      const provider = injector.getInstance(ServiceStatusProvider)
      await provider.install('admin', 'password123')

      const elevated = createElevatedContext(injector)
      const repository = getRepository(elevated)

      const users = await repository.getDataSetFor(User, 'username').find(elevated, {})
      expect(users).toHaveLength(1)
      expect(users[0].username).toBe('admin')
      expect(users[0].roles).toContain('admin')

      const credentials = await repository.getDataSetFor(PasswordCredential, 'userName').find(elevated, {})
      expect(credentials).toHaveLength(1)
      expect(credentials[0].userName).toBe('admin')
      await elevated[Symbol.asyncDispose]()
    })

    it('should throw if service is already installed', async () => {
      const injector = setupInjector()
      const provider = injector.getInstance(ServiceStatusProvider)
      await provider.install('admin', 'password123')

      await expect(provider.install('admin2', 'password456')).rejects.toThrow('Service is already installed')
    })

    it('should create valid password credentials after install', async () => {
      const injector = setupInjector()
      const provider = injector.getInstance(ServiceStatusProvider)
      await provider.install('admin', 'secret')

      const authenticator = injector.getInstance(PasswordAuthenticator)
      const result = await authenticator.checkPasswordForUser('admin', 'secret')
      expect(result.isValid).toBe(true)
    })
  })
})
