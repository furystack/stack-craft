import { addStore, InMemoryStore, useSystemIdentityContext } from '@furystack/core'
import { Injector } from '@furystack/inject'
import { useLogging, VerboseConsoleLogger } from '@furystack/logging'
import { getRepository } from '@furystack/repository'
import { usingAsync } from '@furystack/utils'
import { ServiceDefinition, ServiceStateHistory } from 'common'
import { describe, expect, it } from 'vitest'

import { ServiceHistoryAction } from './service-history-action.js'

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

const createSetup = () => {
  const injector = new Injector()
  useLogging(injector, VerboseConsoleLogger)

  const svcDefStore = new InMemoryStore({ model: ServiceDefinition, primaryKey: 'id' })
  addStore(injector, svcDefStore)
  getRepository(injector).createDataSet(ServiceDefinition, 'id', {})

  const historyStore = new InMemoryStore({ model: ServiceStateHistory, primaryKey: 'id' })
  addStore(injector, historyStore)
  getRepository(injector).createDataSet(ServiceStateHistory, 'id', {})

  return { injector, svcDefStore, historyStore }
}

describe('ServiceHistoryAction', () => {
  it('should return history entries for an existing service', async () => {
    const { injector, svcDefStore, historyStore } = createSetup()
    await usingAsync(injector, async () => {
      const ts = new Date().toISOString()
      await svcDefStore.add({
        id: 'svc-1',
        stackName: 'test-stack',
        displayName: 'Test Service',
        runCommand: 'npm start',
        createdAt: ts,
        updatedAt: ts,
      } as ServiceDefinition)

      await historyStore.add({
        id: 1,
        serviceId: 'svc-1',
        event: 'run-started',
        triggeredBy: 'system',
        triggerSource: 'system',
        createdAt: ts,
      } as ServiceStateHistory)

      const elevated = useSystemIdentityContext({ injector })
      const result = await ServiceHistoryAction(
        createMockActionContext({ injector: elevated, urlParams: { id: 'svc-1' }, query: {} }),
      )

      const body = result.chunk as { entries: ServiceStateHistory[] }
      expect(body.entries).toHaveLength(1)
      expect(body.entries[0].serviceId).toBe('svc-1')
    })
  })

  it('should throw 404 when service does not exist', async () => {
    const { injector } = createSetup()
    await usingAsync(injector, async () => {
      const elevated = useSystemIdentityContext({ injector })
      await expect(
        ServiceHistoryAction(
          createMockActionContext({ injector: elevated, urlParams: { id: 'nonexistent' }, query: {} }),
        ),
      ).rejects.toThrow('Service not found')
    })
  })

  it('should respect the limit query parameter', async () => {
    const { injector, svcDefStore, historyStore } = createSetup()
    await usingAsync(injector, async () => {
      const ts = new Date().toISOString()
      await svcDefStore.add({
        id: 'svc-2',
        stackName: 'test-stack',
        displayName: 'Svc 2',
        runCommand: 'npm start',
        createdAt: ts,
        updatedAt: ts,
      } as ServiceDefinition)

      for (let i = 1; i <= 5; i++) {
        await historyStore.add({
          id: i,
          serviceId: 'svc-2',
          event: 'run-started',
          triggeredBy: 'system',
          triggerSource: 'system',
          createdAt: ts,
        } as ServiceStateHistory)
      }

      const elevated = useSystemIdentityContext({ injector })
      const result = await ServiceHistoryAction(
        createMockActionContext({ injector: elevated, urlParams: { id: 'svc-2' }, query: { limit: 2 } }),
      )

      const body = result.chunk as { entries: ServiceStateHistory[] }
      expect(body.entries).toHaveLength(2)
    })
  })
})
