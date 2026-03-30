import { describe, expect, it, vi } from 'vitest'

import { LogStorageService } from '../../../services/log-storage-service.js'
import { createMockActionContext, withTestInjector } from '../../../test-helpers.js'

import { ClearServiceLogsAction } from './clear-service-logs-action.js'

describe('ClearServiceLogsAction', () => {
  it('should call clearLogs with the service id', async () => {
    await withTestInjector(async ({ injector }) => {
      const mockLogStorage = {
        clearLogs: vi.fn().mockResolvedValue(undefined),
      }
      injector.setExplicitInstance(mockLogStorage as unknown as LogStorageService, LogStorageService)

      await ClearServiceLogsAction(createMockActionContext({ injector, urlParams: { id: 'svc-1' } }))

      expect(mockLogStorage.clearLogs).toHaveBeenCalledWith('svc-1')
    })
  })

  it('should return success', async () => {
    await withTestInjector(async ({ injector }) => {
      const mockLogStorage = {
        clearLogs: vi.fn().mockResolvedValue(undefined),
      }
      injector.setExplicitInstance(mockLogStorage as unknown as LogStorageService, LogStorageService)

      const result = await ClearServiceLogsAction(createMockActionContext({ injector, urlParams: { id: 'svc-1' } }))
      const body = result.chunk as { success: boolean }

      expect(body.success).toBe(true)
    })
  })

  it('should forward url param id to clearLogs', async () => {
    await withTestInjector(async ({ injector }) => {
      const mockLogStorage = {
        clearLogs: vi.fn().mockResolvedValue(undefined),
      }
      injector.setExplicitInstance(mockLogStorage as unknown as LogStorageService, LogStorageService)

      await ClearServiceLogsAction(createMockActionContext({ injector, urlParams: { id: 'other-id' } }))

      expect(mockLogStorage.clearLogs).toHaveBeenCalledWith('other-id')
    })
  })
})
