import { Injector } from '@furystack/inject'
import { usingAsync } from '@furystack/utils'
import { describe, expect, it, vi } from 'vitest'

import { InstallApiClient } from './api-clients/install-api-client.js'
import { InstallService } from './install-service.js'

const createMockApiClient = () => ({
  call: vi.fn().mockResolvedValue({ result: { state: 'needsInstall' } }),
})

const createSetup = (injector: Injector) => {
  const mockApi = createMockApiClient()
  injector.setExplicitInstance(mockApi as unknown as InstallApiClient, InstallApiClient)
  const service = injector.getInstance(InstallService)
  return { mockApi, service }
}

describe('InstallService', () => {
  it('should fetch service status from the API', () =>
    usingAsync(new Injector(), async (injector) => {
      const { mockApi, service } = createSetup(injector)

      const result = await service.getServiceStatus()
      expect(result).toEqual({ state: 'needsInstall' })
      expect(mockApi.call).toHaveBeenCalledWith({
        method: 'GET',
        action: '/serviceStatus',
      })
    }))

  it('should cache the result on subsequent calls', () =>
    usingAsync(new Injector(), async (injector) => {
      const { mockApi, service } = createSetup(injector)

      await service.getServiceStatus()
      await service.getServiceStatus()
      expect(mockApi.call).toHaveBeenCalledTimes(1)
    }))

  it('should expose getServiceStatusAsObservable', () =>
    usingAsync(new Injector(), async (injector) => {
      const { service } = createSetup(injector)

      expect(typeof service.getServiceStatusAsObservable).toBe('function')
    }))

  it('should dispose without throwing', () =>
    usingAsync(new Injector(), async (injector) => {
      const { service } = createSetup(injector)

      expect(() => service[Symbol.dispose]()).not.toThrow()
    }))
})
