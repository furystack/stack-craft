import { createInjector as createRootInjector, type Injector } from '@furystack/inject'
import { NotyService } from '@furystack/shades-common-components'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const navigateMock = vi.fn()
vi.mock('../../../components/app-routes.js', () => ({
  stackCraftNavigate: (...args: unknown[]) => {
    navigateMock(...args)
  },
}))

import { GitHubReposApiClient } from '../../../services/api-clients/github-repos-api-client.js'
import { PrerequisitesApiClient } from '../../../services/api-clients/prerequisites-api-client.js'
import { ServicesApiClient } from '../../../services/api-clients/services-api-client.js'
import {
  applyServiceFiles,
  createPrerequisite,
  createRepository,
  deleteService,
  runServiceAction,
  saveService,
} from './utils.js'

const createMocks = () => ({
  servicesApi: { call: vi.fn() },
  prereqsApi: { call: vi.fn() },
  reposApi: { call: vi.fn() },
  noty: { emit: vi.fn() },
})

const createInjector = (mocks: ReturnType<typeof createMocks>) => {
  const injector = createRootInjector()
  injector.bind(ServicesApiClient, () => mocks.servicesApi as unknown as ServicesApiClient)
  injector.bind(PrerequisitesApiClient, () => mocks.prereqsApi as unknown as PrerequisitesApiClient)
  injector.bind(GitHubReposApiClient, () => mocks.reposApi as unknown as GitHubReposApiClient)
  injector.bind(NotyService, () => mocks.noty as unknown as NotyService)
  return injector
}

describe('service-detail utils', () => {
  let mocks: ReturnType<typeof createMocks>
  let injector: Injector

  beforeEach(() => {
    mocks = createMocks()
    injector = createInjector(mocks)
    navigateMock.mockClear()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('runServiceAction', () => {
    it('should call the API and reset progress on success', async () => {
      mocks.servicesApi.call.mockResolvedValueOnce({})
      const setProgress = vi.fn()

      await runServiceAction(injector, 'svc-1', '/services/:id/start', setProgress)

      expect(setProgress).toHaveBeenCalledWith('/services/:id/start')
      expect(mocks.servicesApi.call).toHaveBeenCalledWith({
        method: 'POST',
        action: '/services/:id/start',
        url: { id: 'svc-1' },
      })
      expect(setProgress).toHaveBeenLastCalledWith(null)
    })

    it('should show an error notification on failure and reset progress', async () => {
      mocks.servicesApi.call.mockRejectedValueOnce(new Error('timeout'))
      const setProgress = vi.fn()

      await runServiceAction(injector, 'svc-1', '/services/:id/start', setProgress)

      expect(mocks.noty.emit).toHaveBeenCalledWith(
        'onNotyAdded',
        expect.objectContaining({ type: 'error', body: 'timeout' }),
      )
      expect(setProgress).toHaveBeenLastCalledWith(null)
    })

    it('should use the last path segment as the error label', async () => {
      mocks.servicesApi.call.mockRejectedValueOnce('non-error')
      const setProgress = vi.fn()

      await runServiceAction(injector, 'svc-1', '/services/:id/restart', setProgress)

      expect(mocks.noty.emit).toHaveBeenCalledWith('onNotyAdded', expect.objectContaining({ title: 'restart failed' }))
    })
  })

  describe('saveService', () => {
    it('should PATCH the service and return true on success', async () => {
      mocks.servicesApi.call.mockResolvedValueOnce({})

      const result = await saveService(injector, 'svc-1', { displayName: 'Updated' }, 'Original')

      expect(result).toBe(true)
      expect(mocks.servicesApi.call).toHaveBeenCalledWith(
        expect.objectContaining({ method: 'PATCH', action: '/services/:id', url: { id: 'svc-1' } }),
      )
      expect(mocks.noty.emit).toHaveBeenCalledWith(
        'onNotyAdded',
        expect.objectContaining({ type: 'success', body: '"Updated" was updated successfully.' }),
      )
    })

    it('should use currentDisplayName as fallback in the notification', async () => {
      mocks.servicesApi.call.mockResolvedValueOnce({})

      await saveService(injector, 'svc-1', {}, 'Fallback Name')

      expect(mocks.noty.emit).toHaveBeenCalledWith(
        'onNotyAdded',
        expect.objectContaining({ body: '"Fallback Name" was updated successfully.' }),
      )
    })

    it('should return false and show error on failure', async () => {
      mocks.servicesApi.call.mockRejectedValueOnce(new Error('Conflict'))

      const result = await saveService(injector, 'svc-1', {}, 'Name')

      expect(result).toBe(false)
      expect(mocks.noty.emit).toHaveBeenCalledWith(
        'onNotyAdded',
        expect.objectContaining({ type: 'error', body: 'Conflict' }),
      )
    })

    it('should use fallback message for non-Error rejections', async () => {
      mocks.servicesApi.call.mockRejectedValueOnce('oops')

      await saveService(injector, 'svc-1', {}, 'Name')

      expect(mocks.noty.emit).toHaveBeenCalledWith(
        'onNotyAdded',
        expect.objectContaining({ body: 'Failed to update service' }),
      )
    })
  })

  describe('deleteService', () => {
    it('should DELETE the service and navigate on success', async () => {
      mocks.servicesApi.call.mockResolvedValueOnce({})

      await deleteService(injector, 'svc-1', 'My Service', 'my-stack')

      expect(mocks.servicesApi.call).toHaveBeenCalledWith({
        method: 'DELETE',
        action: '/services/:id',
        url: { id: 'svc-1' },
      })
      expect(mocks.noty.emit).toHaveBeenCalledWith(
        'onNotyAdded',
        expect.objectContaining({ type: 'success', body: '"My Service" was deleted.' }),
      )
      expect(navigateMock).toHaveBeenCalledWith(injector, {
        path: '/stacks/:stackName/services',
        params: { stackName: 'my-stack' },
      })
    })

    it('should show error notification on failure without navigating', async () => {
      mocks.servicesApi.call.mockRejectedValueOnce(new Error('Not found'))

      await deleteService(injector, 'svc-1', 'My Service', 'my-stack')

      expect(mocks.noty.emit).toHaveBeenCalledWith(
        'onNotyAdded',
        expect.objectContaining({ type: 'error', body: 'Not found' }),
      )
      expect(navigateMock).not.toHaveBeenCalled()
    })
  })

  describe('createPrerequisite', () => {
    it('should POST a new prerequisite and return its id', async () => {
      mocks.prereqsApi.call.mockResolvedValueOnce({})

      const id = await createPrerequisite(injector, 'my-stack', {
        name: 'Node.js',
        type: 'node',
        config: { minimumVersion: '22' },
      })

      expect(typeof id).toBe('string')
      expect(id.length).toBeGreaterThan(0)
      expect(mocks.prereqsApi.call).toHaveBeenCalledWith(
        expect.objectContaining({
          method: 'POST',
          action: '/prerequisites',
          body: expect.objectContaining({ stackName: 'my-stack', name: 'Node.js', type: 'node' }),
        }),
      )
      expect(mocks.noty.emit).toHaveBeenCalledWith('onNotyAdded', expect.objectContaining({ type: 'success' }))
    })
  })

  describe('createRepository', () => {
    it('should POST a new repository and return its id', async () => {
      mocks.reposApi.call.mockResolvedValueOnce({})

      const id = await createRepository(injector, 'my-stack', {
        url: 'https://github.com/user/repo',
        displayName: 'My Repo',
      })

      expect(typeof id).toBe('string')
      expect(id.length).toBeGreaterThan(0)
      expect(mocks.reposApi.call).toHaveBeenCalledWith(
        expect.objectContaining({
          method: 'POST',
          action: '/github-repositories',
          body: expect.objectContaining({ stackName: 'my-stack', url: 'https://github.com/user/repo' }),
        }),
      )
      expect(mocks.noty.emit).toHaveBeenCalledWith('onNotyAdded', expect.objectContaining({ type: 'success' }))
    })
  })

  describe('applyServiceFiles', () => {
    it('should POST to apply all files when no relativePath is given', async () => {
      mocks.servicesApi.call.mockResolvedValueOnce({})
      const setProgress = vi.fn()

      await applyServiceFiles(injector, 'svc-1', setProgress)

      expect(setProgress).toHaveBeenCalledWith('apply-files-all')
      expect(mocks.servicesApi.call).toHaveBeenCalledWith(
        expect.objectContaining({
          method: 'POST',
          action: '/services/:id/apply-files',
          body: {},
        }),
      )
      expect(mocks.noty.emit).toHaveBeenCalledWith(
        'onNotyAdded',
        expect.objectContaining({ type: 'success', body: 'All shared files were written to disk.' }),
      )
      expect(setProgress).toHaveBeenLastCalledWith(null)
    })

    it('should POST with relativePath when specified', async () => {
      mocks.servicesApi.call.mockResolvedValueOnce({})
      const setProgress = vi.fn()

      await applyServiceFiles(injector, 'svc-1', setProgress, '.env')

      expect(setProgress).toHaveBeenCalledWith('apply-file-.env')
      expect(mocks.servicesApi.call).toHaveBeenCalledWith(
        expect.objectContaining({
          body: { relativePath: '.env' },
        }),
      )
      expect(mocks.noty.emit).toHaveBeenCalledWith(
        'onNotyAdded',
        expect.objectContaining({ body: '.env was written to disk.' }),
      )
    })

    it('should show error notification on failure', async () => {
      mocks.servicesApi.call.mockRejectedValueOnce(new Error('Permission denied'))
      const setProgress = vi.fn()

      await applyServiceFiles(injector, 'svc-1', setProgress)

      expect(mocks.noty.emit).toHaveBeenCalledWith(
        'onNotyAdded',
        expect.objectContaining({ type: 'error', body: 'Permission denied' }),
      )
      expect(setProgress).toHaveBeenLastCalledWith(null)
    })
  })
})
