import { Injector } from '@furystack/inject'
import { useLogging, VerboseConsoleLogger } from '@furystack/logging'
import type { ServiceLogEntry } from 'common'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { LogStorageService } from '../../../services/log-storage-service.js'
import { ServiceLogsAction } from './service-logs-action.js'

const createMockActionContext = <TUrl = Record<string, string>, TQuery = Record<string, unknown>>(options: {
  injector: Injector
  urlParams?: TUrl
  query?: TQuery
}) => ({
  injector: options.injector,
  getBody: () => Promise.resolve(undefined as never),
  getUrlParams: () => (options.urlParams ?? {}) as TUrl,
  getQuery: () => (options.query ?? {}) as TQuery,
  request: {} as never,
  response: {} as never,
})

describe('ServiceLogsAction', () => {
  let injector: Injector
  let mockLogStorage: { getEntries: ReturnType<typeof vi.fn> }

  beforeEach(() => {
    injector = new Injector()
    useLogging(injector, VerboseConsoleLogger)

    mockLogStorage = {
      getEntries: vi.fn().mockResolvedValue([]),
    }
    injector.setExplicitInstance(mockLogStorage as unknown as LogStorageService, LogStorageService)
  })

  afterEach(async () => {
    await injector[Symbol.asyncDispose]()
  })

  it('should return entries from LogStorageService', async () => {
    const entries: Array<Partial<ServiceLogEntry>> = [{ serviceId: 'svc-1', line: 'hello', stream: 'stdout' }]
    mockLogStorage.getEntries.mockResolvedValue(entries)

    const result = await ServiceLogsAction(createMockActionContext({ injector, urlParams: { id: 'svc-1' }, query: {} }))
    const body = result.chunk as { entries: ServiceLogEntry[] }

    expect(body.entries).toEqual(entries)
    expect(mockLogStorage.getEntries).toHaveBeenCalledWith('svc-1', {
      limit: undefined,
      processUid: undefined,
      search: undefined,
    })
  })

  it('should pass parsed line count as limit', async () => {
    await ServiceLogsAction(createMockActionContext({ injector, urlParams: { id: 'svc-1' }, query: { lines: 50 } }))

    expect(mockLogStorage.getEntries).toHaveBeenCalledWith('svc-1', expect.objectContaining({ limit: 50 }))
  })

  it('should pass processUid filter', async () => {
    await ServiceLogsAction(
      createMockActionContext({
        injector,
        urlParams: { id: 'svc-1' },
        query: { processUid: 'uid-123' },
      }),
    )

    expect(mockLogStorage.getEntries).toHaveBeenCalledWith('svc-1', expect.objectContaining({ processUid: 'uid-123' }))
  })

  it('should pass search filter', async () => {
    await ServiceLogsAction(
      createMockActionContext({
        injector,
        urlParams: { id: 'svc-1' },
        query: { search: 'error' },
      }),
    )

    expect(mockLogStorage.getEntries).toHaveBeenCalledWith('svc-1', expect.objectContaining({ search: 'error' }))
  })

  it('should treat non-finite line count as undefined limit', async () => {
    await ServiceLogsAction(
      createMockActionContext({
        injector,
        urlParams: { id: 'svc-1' },
        query: { lines: Infinity },
      }),
    )

    expect(mockLogStorage.getEntries).toHaveBeenCalledWith('svc-1', expect.objectContaining({ limit: undefined }))
  })
})
