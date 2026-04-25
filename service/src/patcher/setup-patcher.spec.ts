import { addStore, InMemoryStore } from '@furystack/core'
import { Injector } from '@furystack/inject'
import { useLogging, VerboseConsoleLogger } from '@furystack/logging'
import { getRepository } from '@furystack/repository'
import { usingAsync } from '@furystack/utils'
import { PatchRun, ServiceStatus } from 'common'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { Patch } from './patch.js'

const { mockUseSequelize, mockCheckOrphan, mockRunPatch, mockPatchList } = vi.hoisted(() => ({
  mockUseSequelize: vi.fn(),
  mockCheckOrphan: vi.fn(),
  mockRunPatch: vi.fn(),
  mockPatchList: [] as Patch[],
}))

vi.mock('@furystack/sequelize-store', () => ({
  useSequelize: mockUseSequelize,
}))

vi.mock('../config.js', () => ({
  authorizedDataSet: {},
}))

vi.mock('../app-models/data-store/db-options.js', () => ({
  getDbOptions: () => ({}),
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

const { setupPatcher } = await import('./setup-patcher.js')

const primeInjector = (injector: Injector) => {
  useLogging(injector, VerboseConsoleLogger)
  addStore(injector, new InMemoryStore({ model: PatchRun, primaryKey: 'id' }))
  addStore(injector, new InMemoryStore({ model: ServiceStatus, primaryKey: 'serviceId' }))
  getRepository(injector).createDataSet(ServiceStatus, 'serviceId', {})
}

const makePatch = (id: string): Patch => ({
  id,
  name: `name-${id}`,
  description: `desc-${id}`,
  run: async () => undefined,
})

beforeEach(() => {
  mockUseSequelize.mockReset()
  mockCheckOrphan.mockReset()
  mockRunPatch.mockReset()
  mockPatchList.length = 0
})

describe('setupPatcher', () => {
  it('calls useSequelize once to register the PatchRun model', () =>
    usingAsync(new Injector(), async (injector) => {
      primeInjector(injector)
      mockCheckOrphan.mockResolvedValue(undefined)

      await setupPatcher(injector)

      expect(mockUseSequelize).toHaveBeenCalledTimes(1)
      const [firstCall] = mockUseSequelize.mock.calls
      expect(firstCall?.[0]).toMatchObject({ model: PatchRun, primaryKey: 'id' })
    }))

  it('checks for orphaned patches before running any patch', () =>
    usingAsync(new Injector(), async (injector) => {
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
    usingAsync(new Injector(), async (injector) => {
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
    usingAsync(new Injector(), async (injector) => {
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
    usingAsync(new Injector(), async (injector) => {
      primeInjector(injector)
      mockCheckOrphan.mockResolvedValue(undefined)

      await setupPatcher(injector)

      expect(mockCheckOrphan).toHaveBeenCalledTimes(1)
      expect(mockRunPatch).not.toHaveBeenCalled()
    }))
})
