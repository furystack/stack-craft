import { InMemoryStore, useSystemIdentityContext } from '@furystack/core'
import { createInjector, type Injector } from '@furystack/inject'
import { useLogging, VerboseConsoleLogger } from '@furystack/logging'
import { usingAsync } from '@furystack/utils'
import { PatchRun } from 'common'
import { describe, expect, it } from 'vitest'

import { checkForOrphanedPatch } from './check-for-orphaned-patch.js'
import { PatchRunDataSet, PatchRunStoreToken } from './setup-patcher.js'

const setupInjector = (parent: Injector) => {
  useLogging(parent, VerboseConsoleLogger)
  const store = new InMemoryStore({ model: PatchRun, primaryKey: 'id' as const })
  parent.bind(PatchRunStoreToken, () => store)
  const elevated = useSystemIdentityContext({ injector: parent })
  return { store, ds: elevated.get(PatchRunDataSet), elevated }
}

describe('checkForOrphanedPatch', () => {
  it('transitions running entries to orphaned', () =>
    usingAsync(createInjector(), async (injector) => {
      const { store, ds, elevated } = setupInjector(injector)
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

      await checkForOrphanedPatch(elevated, ds)

      const rows = await store.find({})
      expect(rows[0]?.status).toBe('orphaned')
      expect(rows[0]?.log[0]?.message).toContain('Orphaned')
    }))

  it('does nothing when no running entries exist', () =>
    usingAsync(createInjector(), async (injector) => {
      const { store, ds, elevated } = setupInjector(injector)
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

      await checkForOrphanedPatch(elevated, ds)

      const rows = await store.find({})
      expect(rows[0]?.status).toBe('success')
    }))
})
