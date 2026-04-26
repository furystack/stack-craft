import { InMemoryStore, useSystemIdentityContext } from '@furystack/core'
import { createInjector, type Injector } from '@furystack/inject'
import { useLogging, VerboseConsoleLogger } from '@furystack/logging'
import { usingAsync } from '@furystack/utils'
import { PatchRun, ServiceStatus } from 'common'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { Patch } from './patch.js'

const { mockCheckOrphan, mockRunPatch, mockPatchList } = vi.hoisted(() => ({
  mockCheckOrphan: vi.fn(),
  mockRunPatch: vi.fn(),
  mockPatchList: [] as Patch[],
}))

vi.mock('./check-for-orphaned-patch.js', () => ({
  checkForOrphanedPatch: mockCheckOrphan,
}))

vi.mock('./run-patch.js', () => ({
  runPatch: mockRunPatch,
}))

vi.mock('./0000-patch-list.js', () => ({
  get patchList() {
    return mockPatchList
  },
}))

const { setupPatcher, PatchRunStoreToken } = await import('./setup-patcher.js')
const { ServiceStatusStore } = await import('../app-models/data-store/tokens.js')

const primeInjector = (injector: Injector): void => {
  useLogging(injector, VerboseConsoleLogger)
  injector.bind(PatchRunStoreToken, () => new InMemoryStore({ model: PatchRun, primaryKey: 'id' as const }))
  injector.bind(ServiceStatusStore, () => new InMemoryStore({ model: ServiceStatus, primaryKey: 'serviceId' as const }))
  // Force eager resolution so the elevated context inside setupPatcher does
  // not have to bind the store at the wrong scope.
  useSystemIdentityContext({ injector })
}

const makePatch = (id: string): Patch => ({
  id,
  name: `name-${id}`,
  description: `desc-${id}`,
  run: async () => undefined,
})

beforeEach(() => {
  mockCheckOrphan.mockReset()
  mockRunPatch.mockReset()
  mockPatchList.length = 0
})

describe('setupPatcher', () => {
  it('checks for orphaned patches before running any patch', () =>
    usingAsync(createInjector(), async (injector) => {
      primeInjector(injector)
      const callOrder: string[] = []
      mockCheckOrphan.mockImplementation(async () => {
        callOrder.push('orphan-check')
      })
      mockRunPatch.mockImplementation(async (_i: Injector, patch: Patch) => {
        callOrder.push(`run-${patch.id}`)
      })
      mockPatchList.push(makePatch('p1'))

      await setupPatcher(injector)

      expect(callOrder).toEqual(['orphan-check', 'run-p1'])
    }))

  it('iterates patches in declaration order', () =>
    usingAsync(createInjector(), async (injector) => {
      primeInjector(injector)
      const runOrder: string[] = []
      mockCheckOrphan.mockResolvedValue(undefined)
      mockRunPatch.mockImplementation(async (_i: Injector, patch: Patch) => {
        runOrder.push(patch.id)
      })
      mockPatchList.push(makePatch('a'), makePatch('b'), makePatch('c'))

      await setupPatcher(injector)

      expect(runOrder).toEqual(['a', 'b', 'c'])
      expect(mockRunPatch).toHaveBeenCalledTimes(3)
    }))

  it('propagates errors from a failing patch and stops further iteration', () =>
    usingAsync(createInjector(), async (injector) => {
      primeInjector(injector)
      mockCheckOrphan.mockResolvedValue(undefined)
      mockRunPatch
        .mockImplementationOnce(async () => undefined)
        .mockImplementationOnce(async () => {
          throw new Error('boom')
        })
        .mockImplementationOnce(async () => undefined)
      mockPatchList.push(makePatch('a'), makePatch('b'), makePatch('c'))

      await expect(setupPatcher(injector)).rejects.toThrow('boom')
      expect(mockRunPatch).toHaveBeenCalledTimes(2)
    }))

  it('is a no-op when the patch list is empty', () =>
    usingAsync(createInjector(), async (injector) => {
      primeInjector(injector)
      mockCheckOrphan.mockResolvedValue(undefined)

      await setupPatcher(injector)

      expect(mockCheckOrphan).toHaveBeenCalledTimes(1)
      expect(mockRunPatch).not.toHaveBeenCalled()
    }))
})
