import { InMemoryStore, useSystemIdentityContext } from '@furystack/core'
import { createInjector, type Injector } from '@furystack/inject'
import { useLogging, VerboseConsoleLogger } from '@furystack/logging'
import { usingAsync } from '@furystack/utils'
import { PatchRun } from 'common'
import { describe, expect, it, vi } from 'vitest'

import type { Patch } from './patch.js'
import { runPatch } from './run-patch.js'
import { PatchRunDataSet, PatchRunStoreToken } from './setup-patcher.js'

const setupInjector = (parent: Injector) => {
  useLogging(parent, VerboseConsoleLogger)
  let idCounter = 0
  const store = new InMemoryStore<PatchRun, 'id'>({ model: PatchRun, primaryKey: 'id' })
  const originalAdd = store.add.bind(store)
  store.add = async (entry: PatchRun) => originalAdd({ ...entry, id: entry.id ?? `patch-${++idCounter}` })
  parent.bind(PatchRunStoreToken, () => store)
  const elevated = useSystemIdentityContext({ injector: parent })
  return { store, ds: elevated.get(PatchRunDataSet), elevated }
}

describe('runPatch', () => {
  const basePatch: Patch = {
    id: 'patch-x',
    name: 'Test Patch',
    description: 'desc',
    run: async (_injector, log) => {
      log('hello')
    },
  }

  it('runs the patch and marks it success', () =>
    usingAsync(createInjector(), async (injector) => {
      const { ds, store, elevated } = setupInjector(injector)

      await runPatch(elevated, basePatch, ds)

      const rows = await store.find({})
      expect(rows).toHaveLength(1)
      expect(rows[0]?.status).toBe('success')
      expect(rows[0]?.log.map((l) => l.message)).toContain('hello')
    }))

  it('skips when a previous run succeeded', () =>
    usingAsync(createInjector(), async (injector) => {
      const { ds, store, elevated } = setupInjector(injector)
      const now = new Date()
      await store.add({
        id: 'prev',
        patchId: basePatch.id,
        name: basePatch.name,
        description: basePatch.description,
        status: 'success',
        log: [],
        createdAt: now,
        updatedAt: now,
      })

      const spy = vi.fn()
      await runPatch(elevated, { ...basePatch, run: spy }, ds)

      expect(spy).not.toHaveBeenCalled()
      const rows = await store.find({})
      expect(rows).toHaveLength(1)
    }))

  it('marks the run failed and rethrows when the patch throws', () =>
    usingAsync(createInjector(), async (injector) => {
      const { ds, store, elevated } = setupInjector(injector)
      const failing: Patch = { ...basePatch, run: async () => Promise.reject(new Error('boom')) }

      await expect(runPatch(elevated, failing, ds)).rejects.toThrow('boom')

      const rows = await store.find({})
      expect(rows).toHaveLength(1)
      expect(rows[0]?.status).toBe('failed')
    }))
})
