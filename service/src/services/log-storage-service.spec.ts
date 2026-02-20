import { addStore, InMemoryStore } from '@furystack/core'
import { Injector } from '@furystack/inject'
import { useLogging, VerboseConsoleLogger } from '@furystack/logging'
import { getRepository } from '@furystack/repository'
import { ServiceLogEntry } from 'common'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { LogStorageService } from './log-storage-service.js'

describe('LogStorageService', () => {
  let injector: Injector
  let logStorage: LogStorageService

  beforeEach(() => {
    injector = new Injector()
    useLogging(injector, VerboseConsoleLogger)
    addStore(injector, new InMemoryStore({ model: ServiceLogEntry, primaryKey: 'id' }))
    getRepository(injector).createDataSet(ServiceLogEntry, 'id', {})
    logStorage = injector.getInstance(LogStorageService)
  })

  afterEach(async () => {
    await logStorage[Symbol.asyncDispose]()
    try {
      await injector[Symbol.asyncDispose]()
    } catch {
      // May already be disposed
    }
  })

  it('should add and retrieve log entries', async () => {
    await logStorage.addEntry('svc-1', 'proc-1', 'stdout', 'hello world')
    await logStorage.addEntry('svc-1', 'proc-1', 'stderr', 'error line')

    const entries = await logStorage.getEntries('svc-1')
    expect(entries).toHaveLength(2)
    expect(entries[0].line).toBe('error line')
    expect(entries[1].line).toBe('hello world')
  })

  it('should return empty array for unknown service', async () => {
    const entries = await logStorage.getEntries('nonexistent')
    expect(entries).toEqual([])
  })

  it('should respect the limit parameter', async () => {
    for (let i = 0; i < 10; i++) {
      await logStorage.addEntry('svc-1', 'proc-1', 'stdout', `line ${i}`)
    }

    const entries = await logStorage.getEntries('svc-1', { limit: 3 })
    expect(entries).toHaveLength(3)
  })

  it('should filter by processUid', async () => {
    await logStorage.addEntry('svc-1', 'proc-1', 'stdout', 'first session')
    await logStorage.addEntry('svc-1', 'proc-2', 'stdout', 'second session')

    const entries = await logStorage.getEntries('svc-1', { processUid: 'proc-1' })
    expect(entries).toHaveLength(1)
    expect(entries[0].line).toBe('first session')
  })

  it('should clear logs for a service', async () => {
    await logStorage.addEntry('svc-1', 'proc-1', 'stdout', 'line 1')
    await logStorage.addEntry('svc-1', 'proc-1', 'stdout', 'line 2')
    await logStorage.addEntry('svc-2', 'proc-2', 'stdout', 'other service')

    await logStorage.clearLogs('svc-1')

    const svc1Entries = await logStorage.getEntries('svc-1')
    expect(svc1Entries).toHaveLength(0)

    const svc2Entries = await logStorage.getEntries('svc-2')
    expect(svc2Entries).toHaveLength(1)
  })

  it('should prune old entries when exceeding max', async () => {
    for (let i = 0; i < 10; i++) {
      await logStorage.addEntry('svc-1', 'proc-1', 'stdout', `line ${i}`)
    }

    await logStorage.prune('svc-1', 5)

    const entries = await logStorage.getEntries('svc-1', { limit: 100 })
    expect(entries).toHaveLength(5)
    expect(entries[0].line).toBe('line 9')
    expect(entries[4].line).toBe('line 5')
  })

  it('should not prune when below max', async () => {
    for (let i = 0; i < 3; i++) {
      await logStorage.addEntry('svc-1', 'proc-1', 'stdout', `line ${i}`)
    }

    await logStorage.prune('svc-1', 10)

    const entries = await logStorage.getEntries('svc-1', { limit: 100 })
    expect(entries).toHaveLength(3)
  })
})
