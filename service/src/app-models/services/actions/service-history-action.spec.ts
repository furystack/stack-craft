import type { Injector } from '@furystack/inject'
import { getRepository } from '@furystack/repository'
import type { ServiceHistoryEndpoint } from 'common'
import { ServiceDefinition, ServiceStateHistory } from 'common'
import { describe, expect, it } from 'vitest'

import type { RequestActionOptions } from '@furystack/rest-service'
import { withTestInjector } from '../../../test-helpers.js'

import { ServiceHistoryAction } from './service-history-action.js'

const createHistoryContext = (options: {
  injector: Injector
  urlParams: { id: string }
  query?: Record<string, unknown>
}): RequestActionOptions<ServiceHistoryEndpoint> =>
  ({
    injector: options.injector,
    getBody: () => Promise.resolve(undefined),
    getUrlParams: () => options.urlParams,
    getQuery: () => options.query ?? {},
    request: {} as never,
    response: {} as never,
  }) as unknown as RequestActionOptions<ServiceHistoryEndpoint>

const createTestServiceDef = (overrides: Partial<ServiceDefinition> = {}): ServiceDefinition => ({
  id: 'svc-1',
  stackName: 'test-stack',
  displayName: 'Test Service',
  description: '',
  files: [],
  runCommand: 'npm start',
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  ...overrides,
})

describe('ServiceHistoryAction', () => {
  it('should return history entries for an existing service', async () => {
    await withTestInjector(async ({ elevated }) => {
      const ts = new Date().toISOString()
      const repo = getRepository(elevated)
      await repo.getDataSetFor(ServiceDefinition, 'id').add(elevated, createTestServiceDef())

      await repo.getDataSetFor(ServiceStateHistory, 'id').add(elevated, {
        id: 1,
        serviceId: 'svc-1',
        event: 'run-started',
        triggeredBy: 'system',
        triggerSource: 'system',
        createdAt: ts,
      })

      const result = await ServiceHistoryAction(
        createHistoryContext({ injector: elevated, urlParams: { id: 'svc-1' }, query: {} }),
      )

      const body = result.chunk as { entries: ServiceStateHistory[] }
      expect(body.entries).toHaveLength(1)
      expect(body.entries[0].serviceId).toBe('svc-1')
    })
  })

  it('should throw 404 when service does not exist', async () => {
    await withTestInjector(async ({ elevated }) => {
      await expect(
        ServiceHistoryAction(createHistoryContext({ injector: elevated, urlParams: { id: 'nonexistent' }, query: {} })),
      ).rejects.toThrow('Service not found')
    })
  })

  it('should respect the limit query parameter', async () => {
    await withTestInjector(async ({ elevated }) => {
      const ts = new Date().toISOString()
      const repo = getRepository(elevated)
      await repo
        .getDataSetFor(ServiceDefinition, 'id')
        .add(elevated, createTestServiceDef({ id: 'svc-2', displayName: 'Svc 2' }))

      for (let i = 1; i <= 5; i++) {
        await repo.getDataSetFor(ServiceStateHistory, 'id').add(elevated, {
          id: i,
          serviceId: 'svc-2',
          event: 'run-started',
          triggeredBy: 'system',
          triggerSource: 'system',
          createdAt: ts,
        })
      }

      const result = await ServiceHistoryAction(
        createHistoryContext({ injector: elevated, urlParams: { id: 'svc-2' }, query: { limit: 2 } }),
      )

      const body = result.chunk as { entries: ServiceStateHistory[] }
      expect(body.entries).toHaveLength(2)
    })
  })
})
