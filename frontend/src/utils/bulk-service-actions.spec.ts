import { createInjector } from '@furystack/inject'
import { NotyService } from '@furystack/shades-common-components'
import { describe, expect, it, vi } from 'vitest'
import type { ServiceView } from 'common'

import { ServicesApiClient } from '../services/api-clients/services-api-client.js'
import { runBulkServiceAction } from './bulk-service-actions.js'

const baseService: ServiceView = {
  id: 'svc-1',
  serviceId: 'svc-1',
  stackName: 'stack-1',
  displayName: 'Service One',
  description: '',
  runCommand: 'npm start',
  prerequisiteIds: [],
  prerequisiteServiceIds: [],
  files: [],
  autoFetchEnabled: false,
  autoFetchIntervalMinutes: 60,
  autoRestartOnFetch: false,
  environmentVariableOverrides: {},
  localFiles: [],
  cloneStatus: 'cloned',
  installStatus: 'installed',
  buildStatus: 'built',
  runStatus: 'stopped',
  repositoryId: 'repo-1',
  createdAt: '',
  updatedAt: '',
}

describe('runBulkServiceAction', () => {
  it('should start only stopped ready services', async () => {
    const call = vi.fn().mockResolvedValueOnce({}).mockRejectedValueOnce(new Error('fail'))
    const notyEmit = vi.fn()
    const injector = createInjector()
    injector.bind(ServicesApiClient, () => ({ call }))
    injector.bind(NotyService, () => ({ emit: notyEmit }) as unknown as NotyService)

    const services: ServiceView[] = [
      { ...baseService, id: 'a', runStatus: 'stopped' },
      { ...baseService, id: 'b', runStatus: 'running' },
      { ...baseService, id: 'c', runStatus: 'stopped', displayName: 'Broken' },
    ]

    await runBulkServiceAction(injector, services, 'start')

    expect(call).toHaveBeenCalledTimes(2)
    expect(call).toHaveBeenCalledWith({
      method: 'POST',
      action: '/services/:id/start',
      url: { id: 'a' },
    })
    expect(notyEmit).toHaveBeenCalledWith('onNotyAdded', {
      title: 'Start failed',
      body: 'Failed for: Broken',
      type: 'error',
    })
  })

  it('should stop only running services', async () => {
    const call = vi.fn().mockResolvedValue({})
    const injector = createInjector()
    injector.bind(ServicesApiClient, () => ({ call }))
    injector.bind(NotyService, () => ({ emit: vi.fn() }) as unknown as NotyService)

    await runBulkServiceAction(
      injector,
      [
        { ...baseService, id: 'a', runStatus: 'running' },
        { ...baseService, id: 'b', runStatus: 'stopped' },
      ],
      'stop',
    )

    expect(call).toHaveBeenCalledOnce()
    expect(call).toHaveBeenCalledWith({
      method: 'POST',
      action: '/services/:id/stop',
      url: { id: 'a' },
    })
  })

  it('should update only cloned services with a repository', async () => {
    const call = vi.fn().mockResolvedValue({})
    const injector = createInjector()
    injector.bind(ServicesApiClient, () => ({ call }))
    injector.bind(NotyService, () => ({ emit: vi.fn() }) as unknown as NotyService)

    await runBulkServiceAction(
      injector,
      [
        { ...baseService, id: 'a' },
        { ...baseService, id: 'b', cloneStatus: 'not-cloned' },
        { ...baseService, id: 'c', repositoryId: undefined },
      ],
      'update',
    )

    expect(call).toHaveBeenCalledOnce()
    expect(call).toHaveBeenCalledWith({
      method: 'POST',
      action: '/services/:id/update',
      url: { id: 'a' },
    })
  })
})
