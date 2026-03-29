import { Injector } from '@furystack/inject'
import { useLogging, VerboseConsoleLogger } from '@furystack/logging'
import { usingAsync } from '@furystack/utils'
import { describe, expect, it, vi } from 'vitest'

import { ServiceLifecycleAction } from './service-lifecycle-action.js'
import { ProcessManager } from '../../../services/process-manager.js'

const createMockActionContext = <TBody = unknown, TUrl = Record<string, string>>(options: {
  injector: Injector
  body?: TBody
  urlParams?: TUrl
}) => ({
  injector: options.injector,
  getBody: () => Promise.resolve(options.body as TBody),
  getUrlParams: () => (options.urlParams ?? {}) as TUrl,
  getQuery: () => ({}) as never,
  request: {} as never,
  response: {} as never,
})

const createSetup = () => {
  const injector = new Injector()
  useLogging(injector, VerboseConsoleLogger)

  const mockPm = {
    startService: vi.fn().mockResolvedValue(undefined),
    stopService: vi.fn().mockResolvedValue(undefined),
    restartService: vi.fn().mockResolvedValue(undefined),
    installService: vi.fn().mockResolvedValue(undefined),
    buildService: vi.fn().mockResolvedValue(undefined),
    cloneOrPullService: vi.fn().mockResolvedValue({ cloned: false, pulled: true, updated: true }),
    setupService: vi.fn().mockResolvedValue(undefined),
    updateService: vi.fn().mockResolvedValue(undefined),
  }
  injector.setExplicitInstance(mockPm as unknown as ProcessManager, ProcessManager)

  return { injector, mockPm }
}

describe('ServiceLifecycleAction', () => {
  describe('delegation to ProcessManager', () => {
    it('should delegate "start" to ProcessManager.startService', async () => {
      const { injector, mockPm } = createSetup()
      await usingAsync(injector, async () => {
        const action = ServiceLifecycleAction('start')
        const ctx = createMockActionContext({ injector, urlParams: { id: 'svc-1' } })
        const result = await action(ctx)
        const body = result.chunk as { success: boolean; serviceId: string }

        expect(body.success).toBe(true)
        expect(body.serviceId).toBe('svc-1')
        expect(mockPm.startService).toHaveBeenCalledWith('svc-1', expect.objectContaining({ triggerSource: 'api' }))
      })
    })

    it('should delegate "stop" to ProcessManager.stopService', async () => {
      const { injector, mockPm } = createSetup()
      await usingAsync(injector, async () => {
        const action = ServiceLifecycleAction('stop')
        await action(createMockActionContext({ injector, urlParams: { id: 'svc-2' } }))
        expect(mockPm.stopService).toHaveBeenCalledWith('svc-2', expect.objectContaining({ triggerSource: 'api' }))
      })
    })

    it('should delegate "restart" to ProcessManager.restartService', async () => {
      const { injector, mockPm } = createSetup()
      await usingAsync(injector, async () => {
        const action = ServiceLifecycleAction('restart')
        await action(createMockActionContext({ injector, urlParams: { id: 'svc-3' } }))
        expect(mockPm.restartService).toHaveBeenCalledWith('svc-3', expect.objectContaining({ triggerSource: 'api' }))
      })
    })

    it('should delegate "install" to ProcessManager.installService', async () => {
      const { injector, mockPm } = createSetup()
      await usingAsync(injector, async () => {
        const action = ServiceLifecycleAction('install')
        await action(createMockActionContext({ injector, urlParams: { id: 'svc-4' } }))
        expect(mockPm.installService).toHaveBeenCalledWith('svc-4', expect.objectContaining({ triggerSource: 'api' }))
      })
    })

    it('should delegate "build" to ProcessManager.buildService', async () => {
      const { injector, mockPm } = createSetup()
      await usingAsync(injector, async () => {
        const action = ServiceLifecycleAction('build')
        await action(createMockActionContext({ injector, urlParams: { id: 'svc-5' } }))
        expect(mockPm.buildService).toHaveBeenCalledWith('svc-5', expect.objectContaining({ triggerSource: 'api' }))
      })
    })

    it('should delegate "pull" to ProcessManager.cloneOrPullService', async () => {
      const { injector, mockPm } = createSetup()
      await usingAsync(injector, async () => {
        const action = ServiceLifecycleAction('pull')
        await action(createMockActionContext({ injector, urlParams: { id: 'svc-6' } }))
        expect(mockPm.cloneOrPullService).toHaveBeenCalledWith(
          'svc-6',
          expect.objectContaining({ triggerSource: 'api' }),
        )
      })
    })

    it('should delegate "setup" to ProcessManager.setupService', async () => {
      const { injector, mockPm } = createSetup()
      await usingAsync(injector, async () => {
        const action = ServiceLifecycleAction('setup')
        await action(createMockActionContext({ injector, urlParams: { id: 'svc-7' } }))
        expect(mockPm.setupService).toHaveBeenCalledWith('svc-7', expect.objectContaining({ triggerSource: 'api' }))
      })
    })

    it('should delegate "update" to ProcessManager.updateService', async () => {
      const { injector, mockPm } = createSetup()
      await usingAsync(injector, async () => {
        const action = ServiceLifecycleAction('update')
        await action(createMockActionContext({ injector, urlParams: { id: 'svc-8' } }))
        expect(mockPm.updateService).toHaveBeenCalledWith('svc-8', expect.objectContaining({ triggerSource: 'api' }))
      })
    })

    it('should wrap ProcessManager errors into RequestError', async () => {
      const { injector, mockPm } = createSetup()
      await usingAsync(injector, async () => {
        mockPm.startService.mockRejectedValue(new Error('Service not found: svc-bad'))
        const action = ServiceLifecycleAction('start')
        await expect(action(createMockActionContext({ injector, urlParams: { id: 'svc-bad' } }))).rejects.toThrow(
          'Service not found: svc-bad',
        )
      })
    })
  })
})
