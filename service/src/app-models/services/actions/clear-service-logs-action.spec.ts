import { Injector } from '@furystack/inject'
import { useLogging, VerboseConsoleLogger } from '@furystack/logging'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { LogStorageService } from '../../../services/log-storage-service.js'
import { ClearServiceLogsAction } from './clear-service-logs-action.js'

const createMockActionContext = (options: { injector: Injector; urlParams?: Record<string, string> }) => ({
  injector: options.injector,
  getBody: () => Promise.resolve(undefined as never),
  getUrlParams: () => (options.urlParams ?? {}) as never,
  getQuery: () => ({}) as never,
  request: {} as never,
  response: {} as never,
})

describe('ClearServiceLogsAction', () => {
  let injector: Injector
  let mockLogStorage: { clearLogs: ReturnType<typeof vi.fn> }

  beforeEach(() => {
    injector = new Injector()
    useLogging(injector, VerboseConsoleLogger)

    mockLogStorage = {
      clearLogs: vi.fn().mockResolvedValue(undefined),
    }
    injector.setExplicitInstance(mockLogStorage as unknown as LogStorageService, LogStorageService)
  })

  afterEach(async () => {
    await injector[Symbol.asyncDispose]()
  })

  it('should call clearLogs with the service id', async () => {
    await ClearServiceLogsAction(createMockActionContext({ injector, urlParams: { id: 'svc-1' } }))

    expect(mockLogStorage.clearLogs).toHaveBeenCalledWith('svc-1')
  })

  it('should return success', async () => {
    const result = await ClearServiceLogsAction(createMockActionContext({ injector, urlParams: { id: 'svc-1' } }))
    const body = result.chunk as { success: boolean }

    expect(body.success).toBe(true)
  })
})
