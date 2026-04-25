import { addStore, InMemoryStore } from '@furystack/core'
import { Injector } from '@furystack/inject'
import { useLogging, VerboseConsoleLogger } from '@furystack/logging'
import { getRepository } from '@furystack/repository'
import { usingAsync } from '@furystack/utils'
import { PatchRun } from 'common'
import { describe, expect, it, vi } from 'vitest'

import type { Patch } from './patch.js'
import { runPatch } from './run-patch.js'

const setupInjector = (injector: Injector) => {
  useLogging(injector, VerboseConsoleLogger)
  const store = new InMemoryStore({ model: PatchRun, primaryKey: 'id' })
  addStore(injector, store)
  let idCounter = 0
  getRepository(injector).createDataSet(PatchRun, 'id', {
    modifyOnAdd: async ({ entity }) => ({ ...entity, id: entity.id ?? `patch-${++idCounter}` }),
  })
  return { store, ds: getRepository(injector).getDataSetFor(PatchRun, 'id') }
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
    usingAsync(new Injector(), async (injector) => {
      const { ds, store } = setupInjector(injector)

      await runPatch(injector, basePatch, ds)

      const rows = await store.find({})
      expect(rows).toHaveLength(1)
      expect(rows[0]?.status).toBe('success')
      expect(rows[0]?.log.map((l) => l.message)).toContain('hello')
    }))

  it('skips when a previous run succeeded', () =>
    usingAsync(new Injector(), async (injector) => {
      const { ds, store } = setupInjector(injector)
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
      await runPatch(injector, { ...basePatch, run: spy }, ds)

      expect(spy).not.toHaveBeenCalled()
      const rows = await store.find({})
      expect(rows).toHaveLength(1)
    }))

  it('marks the run failed and rethrows when the patch throws', () =>
    usingAsync(new Injector(), async (injector) => {
      const { ds, store } = setupInjector(injector)
      const failing: Patch = { ...basePatch, run: async () => Promise.reject(new Error('boom')) }

      await expect(runPatch(injector, failing, ds)).rejects.toThrow('boom')

      const rows = await store.find({})
      expect(rows).toHaveLength(1)
      expect(rows[0]?.status).toBe('failed')
    }))
})
