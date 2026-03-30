import { Injector } from '@furystack/inject'
import { NotyService } from '@furystack/shades-common-components'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { IdentityApiClient } from './api-clients/identity-api-client.js'
import { SessionService } from './session.js'

const createMocks = () => ({
  api: { call: vi.fn() },
  notys: { emit: vi.fn() },
})

const createService = (mocks: ReturnType<typeof createMocks>): { injector: Injector; service: SessionService } => {
  const injector = new Injector()
  injector.setExplicitInstance(mocks.api as unknown as IdentityApiClient, IdentityApiClient)
  injector.setExplicitInstance(mocks.notys as unknown as NotyService, NotyService)
  const service = injector.getInstance(SessionService)
  return { injector, service }
}

describe('SessionService', () => {
  let mocks: ReturnType<typeof createMocks>
  let service: SessionService

  beforeEach(() => {
    mocks = createMocks()
    mocks.api.call.mockResolvedValue({ result: { isAuthenticated: false } })
    ;({ service } = createService(mocks))
  })

  afterEach(() => {
    service[Symbol.dispose]()
  })

  describe('initial state', () => {
    it('should expose initializing state and null user until isAuthenticated responds', async () => {
      const m = createMocks()
      let resolveFirst!: (value: { result: { isAuthenticated: boolean } }) => void
      const firstCall = new Promise<{ result: { isAuthenticated: boolean } }>((resolve) => {
        resolveFirst = resolve
      })
      m.api.call.mockImplementationOnce(() => firstCall)

      const { service: svc } = createService(m)

      expect(svc.state.getValue()).toBe('initializing')
      expect(svc.currentUser.getValue()).toBeNull()
      expect(svc.loginError.getValue()).toBe('')
      expect(svc.isOperationInProgress.getValue()).toBe(true)

      resolveFirst({ result: { isAuthenticated: false } })
      await vi.waitFor(() => expect(svc.state.getValue()).toBe('unauthenticated'))
      expect(svc.isOperationInProgress.getValue()).toBe(false)
      svc[Symbol.dispose]()
    })

    it('should have empty loginError after init completes', () => {
      expect(service.loginError.getValue()).toBe('')
    })
  })

  describe('isAuthenticated', () => {
    it('should return true when state is authenticated', async () => {
      service.state.setValue('authenticated')
      await expect(service.isAuthenticated()).resolves.toBe(true)
    })

    it('should return false when state is unauthenticated', async () => {
      service.state.setValue('unauthenticated')
      await expect(service.isAuthenticated()).resolves.toBe(false)
    })

    it('should return false when state is initializing', async () => {
      service.state.setValue('initializing')
      await expect(service.isAuthenticated()).resolves.toBe(false)
    })

    it('should return false when state is offline', async () => {
      service.state.setValue('offline')
      await expect(service.isAuthenticated()).resolves.toBe(false)
    })
  })

  describe('isAuthorized', () => {
    it('should return true when user has all requested roles', async () => {
      service.currentUser.setValue({ username: 'test', roles: ['admin', 'editor'] })
      service.state.setValue('authenticated')
      await expect(service.isAuthorized('admin', 'editor')).resolves.toBe(true)
    })

    it('should return false when user is missing a role', async () => {
      service.currentUser.setValue({ username: 'test', roles: ['editor'] })
      service.state.setValue('authenticated')
      await expect(service.isAuthorized('admin')).resolves.toBe(false)
    })

    it('should throw when there is no current user', async () => {
      service.currentUser.setValue(null)
      await expect(service.isAuthorized('admin')).rejects.toThrow('No user available')
    })

    it('should return true when no roles are requested', async () => {
      service.currentUser.setValue({ username: 'test', roles: [] })
      service.state.setValue('authenticated')
      await expect(service.isAuthorized()).resolves.toBe(true)
    })
  })

  describe('getCurrentUser', () => {
    it('should return the current user when set', async () => {
      const user = { username: 'test', roles: ['admin'] }
      service.currentUser.setValue(user)
      await expect(service.getCurrentUser()).resolves.toEqual(user)
    })

    it('should throw when no user is available', async () => {
      service.currentUser.setValue(null)
      await expect(service.getCurrentUser()).rejects.toThrow('No user available')
    })

    it('should emit a notification when no user is available', async () => {
      service.currentUser.setValue(null)
      try {
        await service.getCurrentUser()
      } catch {
        // expected
      }
      expect(mocks.notys.emit).toHaveBeenCalledWith('onNotyAdded', expect.objectContaining({ type: 'warning' }))
    })
  })

  describe('init', () => {
    it('should call GET /isAuthenticated', async () => {
      const m = createMocks()
      m.api.call.mockResolvedValueOnce({ result: { isAuthenticated: false } })

      const { service: svc } = createService(m)

      await vi.waitFor(() => {
        expect(svc.state.getValue()).toBe('unauthenticated')
      })
      expect(m.api.call).toHaveBeenCalledWith({
        method: 'GET',
        action: '/isAuthenticated',
      })
      svc[Symbol.dispose]()
    })

    it('should set state to authenticated and fetch user', async () => {
      const user = { username: 'test', roles: [] }
      const m = createMocks()
      m.api.call.mockResolvedValueOnce({ result: { isAuthenticated: true } }).mockResolvedValueOnce({ result: user })

      const { service: svc } = createService(m)

      await vi.waitFor(() => {
        expect(svc.state.getValue()).toBe('authenticated')
      })
      expect(svc.currentUser.getValue()).toEqual(user)
      svc[Symbol.dispose]()
    })

    it('should set state to unauthenticated when not logged in', async () => {
      const m = createMocks()
      m.api.call.mockResolvedValueOnce({ result: { isAuthenticated: false } })

      const { service: svc } = createService(m)

      await vi.waitFor(() => {
        expect(svc.state.getValue()).toBe('unauthenticated')
      })
      expect(svc.currentUser.getValue()).toBeNull()
      svc[Symbol.dispose]()
    })

    it('should set state to offline when API call fails', async () => {
      const m = createMocks()
      m.api.call.mockRejectedValueOnce(new Error('Network error'))

      const { service: svc } = createService(m)

      await vi.waitFor(() => {
        expect(svc.state.getValue()).toBe('offline')
      })
      svc[Symbol.dispose]()
    })

    it('should only initialize once on repeated init calls', async () => {
      const m = createMocks()
      m.api.call.mockResolvedValue({ result: { isAuthenticated: false } })

      const { service: svc } = createService(m)

      await vi.waitFor(() => {
        expect(svc.state.getValue()).toBe('unauthenticated')
      })

      await svc.init()
      expect(m.api.call).toHaveBeenCalledTimes(1)
      svc[Symbol.dispose]()
    })
  })

  describe('login', () => {
    it('should set user and state on successful login', async () => {
      const user = { username: 'test', roles: ['admin'] }
      mocks.api.call.mockResolvedValueOnce({ result: user })

      await service.login('test', 'password')

      expect(service.currentUser.getValue()).toEqual(user)
      expect(service.state.getValue()).toBe('authenticated')
    })

    it('should POST /login with username and password', async () => {
      mocks.api.call.mockResolvedValueOnce({ result: { username: 'a', roles: [] } })

      await service.login('a', 'secret')

      expect(mocks.api.call).toHaveBeenCalledWith({
        method: 'POST',
        action: '/login',
        body: { username: 'a', password: 'secret' },
      })
    })

    it('should emit a success notification on login', async () => {
      mocks.api.call.mockResolvedValueOnce({ result: { username: 'test', roles: [] } })

      await service.login('test', 'password')

      expect(mocks.notys.emit).toHaveBeenCalledWith('onNotyAdded', expect.objectContaining({ type: 'success' }))
    })

    it('should set loginError on failed login', async () => {
      mocks.api.call.mockRejectedValueOnce(new Error('Invalid credentials'))

      await service.login('test', 'wrong')

      expect(service.loginError.getValue()).toBe('Invalid credentials')
    })

    it('should emit a warning notification on failed login', async () => {
      mocks.api.call.mockRejectedValueOnce(new Error('Invalid credentials'))

      await service.login('test', 'wrong')

      expect(mocks.notys.emit).toHaveBeenCalledWith('onNotyAdded', expect.objectContaining({ type: 'warning' }))
    })

    it('should set loginError to empty string for non-Error rejections', async () => {
      mocks.api.call.mockRejectedValueOnce('some string error')

      await service.login('test', 'wrong')

      expect(service.loginError.getValue()).toBe('')
    })

    it('should set isOperationInProgress to false after login completes', async () => {
      mocks.api.call.mockResolvedValueOnce({ result: { username: 'test', roles: [] } })

      await service.login('test', 'password')

      expect(service.isOperationInProgress.getValue()).toBe(false)
    })
  })

  describe('logout', () => {
    it('should clear user and set state to unauthenticated', async () => {
      service.currentUser.setValue({ username: 'test', roles: [] })
      service.state.setValue('authenticated')
      mocks.api.call.mockResolvedValueOnce({})

      await service.logout()

      expect(service.currentUser.getValue()).toBeNull()
      expect(service.state.getValue()).toBe('unauthenticated')
    })

    it('should POST /logout', async () => {
      mocks.api.call.mockResolvedValueOnce({})

      await service.logout()

      expect(mocks.api.call).toHaveBeenCalledWith({
        method: 'POST',
        action: '/logout',
      })
    })

    it('should emit an info notification', async () => {
      mocks.api.call.mockResolvedValueOnce({})

      await service.logout()

      expect(mocks.notys.emit).toHaveBeenCalledWith('onNotyAdded', expect.objectContaining({ type: 'info' }))
    })

    it('should set isOperationInProgress to false after logout completes', async () => {
      mocks.api.call.mockResolvedValueOnce({})

      await service.logout()

      expect(service.isOperationInProgress.getValue()).toBe(false)
    })
  })

  describe('state transitions', () => {
    it('should go from offline to authenticated after successful login', async () => {
      const m = createMocks()
      m.api.call.mockRejectedValueOnce(new Error('Network error'))

      const { service: svc } = createService(m)

      await vi.waitFor(() => expect(svc.state.getValue()).toBe('offline'))

      const user = { username: 'recovered', roles: ['user'] }
      m.api.call.mockResolvedValueOnce({ result: user })
      await svc.login('recovered', 'pw')

      expect(svc.state.getValue()).toBe('authenticated')
      expect(svc.currentUser.getValue()).toEqual(user)
      expect(m.notys.emit).toHaveBeenCalledWith('onNotyAdded', expect.objectContaining({ type: 'success' }))
      svc[Symbol.dispose]()
    })

    it('should go from authenticated to unauthenticated after logout', async () => {
      const m = createMocks()
      m.api.call.mockResolvedValueOnce({ result: { isAuthenticated: false } })

      const { service: svc } = createService(m)

      await vi.waitFor(() => expect(svc.state.getValue()).toBe('unauthenticated'))

      const user = { username: 't', roles: [] }
      m.api.call.mockResolvedValueOnce({ result: user })
      await svc.login('t', 'p')
      expect(svc.state.getValue()).toBe('authenticated')

      m.api.call.mockResolvedValueOnce({})
      await svc.logout()

      expect(svc.state.getValue()).toBe('unauthenticated')
      expect(svc.currentUser.getValue()).toBeNull()
      expect(m.notys.emit).toHaveBeenCalledWith('onNotyAdded', expect.objectContaining({ type: 'info' }))
      svc[Symbol.dispose]()
    })
  })

  describe('Symbol.dispose', () => {
    it('should dispose all observables without throwing', () => {
      expect(() => service[Symbol.dispose]()).not.toThrow()
    })
  })
})
