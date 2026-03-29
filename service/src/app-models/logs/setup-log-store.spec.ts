import { getStoreManager, useSystemIdentityContext } from '@furystack/core'
import { Injector } from '@furystack/inject'
import { useLogging, VerboseConsoleLogger } from '@furystack/logging'
import { getRepository } from '@furystack/repository'
import { ServiceLogEntry } from 'common'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../../config.js', () => ({
  authorizedDataSet: {},
}))

import { setupLogStore } from './setup-log-store.js'

describe('setupLogStore', () => {
  let injector: Injector

  beforeEach(() => {
    injector = new Injector()
    useLogging(injector, VerboseConsoleLogger)
  })

  afterEach(async () => {
    await injector[Symbol.asyncDispose]()
  })

  it('should register an InMemoryStore for ServiceLogEntry', async () => {
    await setupLogStore(injector)

    const store = getStoreManager(injector).getStoreFor(ServiceLogEntry, 'id')
    expect(store).toBeDefined()
  })

  it('should create a DataSet for ServiceLogEntry', async () => {
    await setupLogStore(injector)

    const ds = getRepository(injector).getDataSetFor(ServiceLogEntry, 'id')
    expect(ds).toBeDefined()
  })

  it('should auto-increment ids via modifyOnAdd', async () => {
    await setupLogStore(injector)

    const elevated = useSystemIdentityContext({ injector })
    const ds = getRepository(elevated).getDataSetFor(ServiceLogEntry, 'id')

    const { created: created1 } = await ds.add(elevated, {
      id: 0,
      serviceId: 'svc-1',
      processUid: 'uid-1',
      stream: 'stdout',
      line: 'first line',
      createdAt: new Date().toISOString(),
    })

    const { created: created2 } = await ds.add(elevated, {
      id: 0,
      serviceId: 'svc-1',
      processUid: 'uid-1',
      stream: 'stderr',
      line: 'second line',
      createdAt: new Date().toISOString(),
    })

    expect(created1[0].id).toBe(1)
    expect(created2[0].id).toBe(2)

    await elevated[Symbol.asyncDispose]()
  })
})
