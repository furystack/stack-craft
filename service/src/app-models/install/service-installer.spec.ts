import { addStore, InMemoryStore } from '@furystack/core'
import { Injector } from '@furystack/inject'
import { useLogging, VerboseConsoleLogger } from '@furystack/logging'
import { PasswordAuthenticator, PasswordCredential, usePasswordPolicy } from '@furystack/security'
import { User } from 'common'
import { describe, expect, it } from 'vitest'
import { ServiceStatusProvider } from './service-installer.js'

const setupInjector = () => {
  const injector = new Injector()
  useLogging(injector, VerboseConsoleLogger)
  addStore(injector, new InMemoryStore({ model: User, primaryKey: 'username' }))
  addStore(injector, new InMemoryStore({ model: PasswordCredential, primaryKey: 'userName' }))
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
      const { getStoreManager } = await import('@furystack/core')
      await getStoreManager(injector).getStoreFor(User, 'username').add({ username: 'admin', roles: [] })

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

      const { getStoreManager } = await import('@furystack/core')
      const sm = getStoreManager(injector)

      const users = await sm.getStoreFor(User, 'username').find({})
      expect(users).toHaveLength(1)
      expect(users[0].username).toBe('admin')
      expect(users[0].roles).toContain('admin')

      const credentials = await sm.getStoreFor(PasswordCredential, 'userName').find({})
      expect(credentials).toHaveLength(1)
      expect(credentials[0].userName).toBe('admin')
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
