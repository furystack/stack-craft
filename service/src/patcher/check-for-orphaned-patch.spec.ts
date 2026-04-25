import { addStore, InMemoryStore } from '@furystack/core'
import { Injector } from '@furystack/inject'
import { useLogging, VerboseConsoleLogger } from '@furystack/logging'
import { getRepository } from '@furystack/repository'
import { usingAsync } from '@furystack/utils'
import { PatchRun } from 'common'
import { describe, expect, it } from 'vitest'

import { checkForOrphanedPatch } from './check-for-orphaned-patch.js'

const setupInjector = (injector: Injector) => {
  useLogging(injector, VerboseConsoleLogger)
  const store = new InMemoryStore({ model: PatchRun, primaryKey: 'id' })
  addStore(injector, store)
  getRepository(injector).createDataSet(PatchRun, 'id', {})
  return { store, ds: getRepository(injector).getDataSetFor(PatchRun, 'id') }
}

describe('checkForOrphanedPatch', () => {
  it('transitions running entries to orphaned', () =>
    usingAsync(new Injector(), async (injector) => {
      const { store, ds } = setupInjector(injector)
      const now = new Date()
      await store.add({
        id: 'p1',
        patchId: 'patch-1',
        name: 'p',
        description: 'd',
        status: 'running',
        log: [],
        createdAt: now,
        updatedAt: now,
      })

      await checkForOrphanedPatch(injector, ds)

      const rows = await store.find({})
      expect(rows[0]?.status).toBe('orphaned')
      expect(rows[0]?.log[0]?.message).toContain('Orphaned')
    }))

  it('does nothing when no running entries exist', () =>
    usingAsync(new Injector(), async (injector) => {
      const { store, ds } = setupInjector(injector)
      const now = new Date()
      await store.add({
        id: 'p1',
        patchId: 'patch-1',
        name: 'p',
        description: 'd',
        status: 'success',
        log: [],
        createdAt: now,
        updatedAt: now,
      })

      await checkForOrphanedPatch(injector, ds)

      const rows = await store.find({})
      expect(rows[0]?.status).toBe('success')
    }))
})
