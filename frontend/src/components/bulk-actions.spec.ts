import { createInjector } from '@furystack/inject'
import type { NotyService } from '@furystack/shades-common-components'
import type { ServiceView } from 'common'
import { describe, expect, it, vi } from 'vitest'

import { ServicesApiClient } from '../services/api-clients/services-api-client.js'
import { bulkApplyFiles, formatUnresolvedSummary } from './bulk-actions.js'

const makeService = (id: string, displayName: string): ServiceView =>
  ({ id, displayName, stackName: 'stack-a' }) as unknown as ServiceView

const okResult = (applied: Array<{ relativePath: string; unresolved: string[] }>, serviceId: string) => ({
  result: { success: true, serviceId, applied },
})

const wireUp = () => {
  const apiCall = vi.fn()
  const notyEmit = vi.fn()
  const injector = createInjector()
  const mockClient = { call: apiCall } as unknown as ServicesApiClient
  injector.bind(ServicesApiClient, () => mockClient)
  const noty = { emit: notyEmit } as unknown as NotyService
  return { injector, noty, apiCall, notyEmit }
}

describe('formatUnresolvedSummary', () => {
  it('returns null when no service has unresolved placeholders', () => {
    expect(
      formatUnresolvedSummary([
        { serviceName: 'A', applied: [{ relativePath: '.env', unresolved: [] }] },
        { serviceName: 'B', applied: [] },
      ]),
    ).toBeNull()
  })

  it('groups by service and joins file-level summaries', () => {
    const summary = formatUnresolvedSummary([
      {
        serviceName: 'File Service',
        applied: [
          { relativePath: 'a/.env', unresolved: ['POSTGRES_USER'] },
          { relativePath: 'a/config.json', unresolved: [] },
        ],
      },
      {
        serviceName: 'Insights Service',
        applied: [{ relativePath: '.env', unresolved: ['POSTGRES_HOST', 'POSTGRES_PASSWORD'] }],
      },
    ])
    expect(summary).toBe(
      'File Service — a/.env: POSTGRES_USER\nInsights Service — .env: POSTGRES_HOST, POSTGRES_PASSWORD',
    )
  })
})

describe('bulkApplyFiles', () => {
  it('emits a success Noty when every service succeeds with no unresolved placeholders', async () => {
    const { injector, noty, apiCall, notyEmit } = wireUp()
    apiCall.mockResolvedValueOnce(okResult([{ relativePath: '.env', unresolved: [] }], 'svc-1'))
    apiCall.mockResolvedValueOnce(okResult([{ relativePath: '.env', unresolved: [] }], 'svc-2'))

    await bulkApplyFiles(injector, noty, [makeService('svc-1', 'A'), makeService('svc-2', 'B')])

    expect(apiCall).toHaveBeenCalledTimes(2)
    expect(notyEmit).toHaveBeenCalledTimes(1)
    expect(notyEmit).toHaveBeenCalledWith(
      'onNotyAdded',
      expect.objectContaining({ type: 'success', body: 'Applied files for 2 service(s).' }),
    )
  })

  it('emits an aggregated warning Noty for unresolved placeholders grouped by service', async () => {
    const { injector, noty, apiCall, notyEmit } = wireUp()
    apiCall.mockResolvedValueOnce(
      okResult([{ relativePath: '.env', unresolved: ['POSTGRES_USER', 'POSTGRES_PASSWORD'] }], 'svc-1'),
    )
    apiCall.mockResolvedValueOnce(okResult([{ relativePath: 'config.json', unresolved: [] }], 'svc-2'))

    await bulkApplyFiles(injector, noty, [makeService('svc-1', 'File Service'), makeService('svc-2', 'B')])

    expect(notyEmit).toHaveBeenCalledWith(
      'onNotyAdded',
      expect.objectContaining({
        type: 'warning',
        title: 'Unresolved template placeholders',
        body: expect.stringContaining('File Service — .env: POSTGRES_USER, POSTGRES_PASSWORD'),
      }),
    )
  })

  it('continues after a per-service failure and emits a separate error Noty', async () => {
    const { injector, noty, apiCall, notyEmit } = wireUp()
    apiCall.mockRejectedValueOnce(new Error('boom'))
    apiCall.mockResolvedValueOnce(okResult([{ relativePath: '.env', unresolved: [] }], 'svc-2'))

    await bulkApplyFiles(injector, noty, [makeService('svc-1', 'Broken'), makeService('svc-2', 'Working')])

    expect(apiCall).toHaveBeenCalledTimes(2)
    expect(notyEmit).toHaveBeenCalledWith(
      'onNotyAdded',
      expect.objectContaining({ type: 'success', body: 'Applied files for 1 service(s).' }),
    )
    expect(notyEmit).toHaveBeenCalledWith(
      'onNotyAdded',
      expect.objectContaining({ type: 'error', body: 'Failed for: Broken' }),
    )
  })

  it('only emits the error Noty when every service fails', async () => {
    const { injector, noty, apiCall, notyEmit } = wireUp()
    apiCall.mockRejectedValueOnce(new Error('boom1'))
    apiCall.mockRejectedValueOnce(new Error('boom2'))

    await bulkApplyFiles(injector, noty, [makeService('svc-1', 'A'), makeService('svc-2', 'B')])

    const successCalls = notyEmit.mock.calls.filter((call) => (call[1] as { type: string }).type === 'success')
    expect(successCalls).toHaveLength(0)
    expect(notyEmit).toHaveBeenCalledWith(
      'onNotyAdded',
      expect.objectContaining({ type: 'error', body: 'Failed for: A, B' }),
    )
  })

  it('does not emit a warning Noty when every successful service is fully resolved', async () => {
    const { injector, noty, apiCall, notyEmit } = wireUp()
    apiCall.mockResolvedValueOnce(okResult([{ relativePath: '.env', unresolved: [] }], 'svc-1'))

    await bulkApplyFiles(injector, noty, [makeService('svc-1', 'A')])

    const warningCalls = notyEmit.mock.calls.filter((call) => (call[1] as { type: string }).type === 'warning')
    expect(warningCalls).toHaveLength(0)
  })
})
