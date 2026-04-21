import type { Injector } from '@furystack/inject'
import type { ServiceLogEntry, ServiceLogsEndpoint } from 'common'
import { describe, expect, it, vi } from 'vitest'

import type { RequestActionOptions } from '@furystack/rest-service'
import { LogStorageService } from '../../../services/log-storage-service.js'
import { withTestInjector } from '../../../test-helpers.js'

import { ServiceLogsAction } from './service-logs-action.js'

const createLogsContext = (options: {
  injector: Injector
  urlParams: { id: string }
  query?: Record<string, unknown>
}): RequestActionOptions<ServiceLogsEndpoint> =>
  ({
    injector: options.injector,
    getBody: () => Promise.resolve(undefined),
    getUrlParams: () => options.urlParams,
    getQuery: () => options.query ?? {},
    request: {} as never,
    response: {} as never,
  }) as unknown as RequestActionOptions<ServiceLogsEndpoint>

describe('ServiceLogsAction', () => {
  it('should return entries from LogStorageService', async () => {
    await withTestInjector(async ({ injector }) => {
      const entries: Array<Partial<ServiceLogEntry>> = [{ serviceId: 'svc-1', line: 'hello', stream: 'stdout' }]
      const mockLogStorage = { getEntries: vi.fn().mockResolvedValue(entries) }
      injector.setExplicitInstance(mockLogStorage as unknown as LogStorageService, LogStorageService)

      const result = await ServiceLogsAction(createLogsContext({ injector, urlParams: { id: 'svc-1' }, query: {} }))
      const body = result.chunk

      expect(body.entries).toEqual(entries)
      expect(mockLogStorage.getEntries).toHaveBeenCalledWith('svc-1', {
        limit: undefined,
        processUid: undefined,
        search: undefined,
      })
    })
  })

  it('should pass parsed line count as limit', async () => {
    await withTestInjector(async ({ injector }) => {
      const mockLogStorage = { getEntries: vi.fn().mockResolvedValue([]) }
      injector.setExplicitInstance(mockLogStorage as unknown as LogStorageService, LogStorageService)

      await ServiceLogsAction(createLogsContext({ injector, urlParams: { id: 'svc-1' }, query: { lines: 50 } }))

      expect(mockLogStorage.getEntries).toHaveBeenCalledWith('svc-1', expect.objectContaining({ limit: 50 }))
    })
  })

  it('should pass processUid filter', async () => {
    await withTestInjector(async ({ injector }) => {
      const mockLogStorage = { getEntries: vi.fn().mockResolvedValue([]) }
      injector.setExplicitInstance(mockLogStorage as unknown as LogStorageService, LogStorageService)

      await ServiceLogsAction(
        createLogsContext({ injector, urlParams: { id: 'svc-1' }, query: { processUid: 'uid-123' } }),
      )

      expect(mockLogStorage.getEntries).toHaveBeenCalledWith(
        'svc-1',
        expect.objectContaining({ processUid: 'uid-123' }),
      )
    })
  })

  it('should pass search filter', async () => {
    await withTestInjector(async ({ injector }) => {
      const mockLogStorage = { getEntries: vi.fn().mockResolvedValue([]) }
      injector.setExplicitInstance(mockLogStorage as unknown as LogStorageService, LogStorageService)

      await ServiceLogsAction(createLogsContext({ injector, urlParams: { id: 'svc-1' }, query: { search: 'error' } }))

      expect(mockLogStorage.getEntries).toHaveBeenCalledWith('svc-1', expect.objectContaining({ search: 'error' }))
    })
  })

  it('should treat non-finite line count as undefined limit', async () => {
    await withTestInjector(async ({ injector }) => {
      const mockLogStorage = { getEntries: vi.fn().mockResolvedValue([]) }
      injector.setExplicitInstance(mockLogStorage as unknown as LogStorageService, LogStorageService)

      await ServiceLogsAction(createLogsContext({ injector, urlParams: { id: 'svc-1' }, query: { lines: Infinity } }))

      expect(mockLogStorage.getEntries).toHaveBeenCalledWith('svc-1', expect.objectContaining({ limit: undefined }))
    })
  })

  it('should forward url param id to LogStorageService', async () => {
    await withTestInjector(async ({ injector }) => {
      const mockLogStorage = { getEntries: vi.fn().mockResolvedValue([]) }
      injector.setExplicitInstance(mockLogStorage as unknown as LogStorageService, LogStorageService)

      await ServiceLogsAction(createLogsContext({ injector, urlParams: { id: 'another-service-id' }, query: {} }))

      expect(mockLogStorage.getEntries).toHaveBeenCalledWith(
        'another-service-id',
        expect.objectContaining({ limit: undefined, processUid: undefined, search: undefined }),
      )
    })
  })
})
