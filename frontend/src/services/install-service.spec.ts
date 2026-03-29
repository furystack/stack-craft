import { Injector } from '@furystack/inject'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { InstallApiClient } from './api-clients/install-api-client.js'
import { InstallService } from './install-service.js'

const createMockApiClient = () => ({
  call: vi.fn().mockResolvedValue({ result: { state: 'needsInstall' } }),
})

describe('InstallService', () => {
  let injector: Injector
  let mockApi: ReturnType<typeof createMockApiClient>
  let service: InstallService

  beforeEach(() => {
    injector = new Injector()
    mockApi = createMockApiClient()
    injector.setExplicitInstance(mockApi as unknown as InstallApiClient, InstallApiClient)
    service = injector.getInstance(InstallService)
  })

  afterEach(() => {
    service[Symbol.dispose]()
  })

  it('should fetch service status from the API', async () => {
    const result = await service.getServiceStatus()
    expect(result).toEqual({ state: 'needsInstall' })
    expect(mockApi.call).toHaveBeenCalledWith({
      method: 'GET',
      action: '/serviceStatus',
    })
  })

  it('should cache the result on subsequent calls', async () => {
    await service.getServiceStatus()
    await service.getServiceStatus()
    expect(mockApi.call).toHaveBeenCalledTimes(1)
  })

  it('should expose getServiceStatusAsObservable', () => {
    expect(typeof service.getServiceStatusAsObservable).toBe('function')
  })

  it('should dispose without throwing', () => {
    expect(() => service[Symbol.dispose]()).not.toThrow()
  })
})
