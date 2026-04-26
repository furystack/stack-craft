import { ServiceDefinitionDataSet, ServiceStatusDataSet } from '../app-models/data-store/tokens.js'
import { getDataSetFor } from '@furystack/repository'
import type { Injector } from '@furystack/inject'
import type { ServiceDefinition, ServiceStatus } from 'common'
import { describe, expect, it, vi } from 'vitest'

import { withTestInjector } from '../test-helpers.js'
import { resolveServiceCwd } from '../utils/resolve-service-cwd.js'
import { GitHeadWatcher } from './git-head-watcher.js'
import { GitWatcher } from './git-watcher.js'
import { ServiceStatusManager } from './service-status-manager.js'
import { StaleStateReconciler } from './stale-state-reconciler.js'
import '../test-shims.js'
vi.mock('../utils/resolve-service-cwd.js', () => ({
  resolveServiceCwd: vi.fn().mockResolvedValue('/tmp/fake-cwd'),
}))

const setupMocks = (injector: Injector) => {
  const mockStatusManager = { updateServiceStatus: vi.fn().mockResolvedValue(undefined) }
  injector.setExplicitInstance(mockStatusManager as unknown as ServiceStatusManager, ServiceStatusManager)

  const mockGitHeadWatcher = { watch: vi.fn().mockResolvedValue(undefined) }
  injector.setExplicitInstance(mockGitHeadWatcher as unknown as GitHeadWatcher, GitHeadWatcher)

  const mockGitWatcher = { startWatching: vi.fn().mockResolvedValue(undefined) }
  injector.setExplicitInstance(mockGitWatcher as unknown as GitWatcher, GitWatcher)

  return { mockStatusManager, mockGitHeadWatcher, mockGitWatcher }
}

const addServiceStatus = async (elevated: Injector, overrides: Partial<ServiceStatus> & { serviceId: string }) => {
  await getDataSetFor(elevated, ServiceStatusDataSet).add(elevated, {
    cloneStatus: 'not-cloned',
    installStatus: 'not-installed',
    buildStatus: 'not-built',
    runStatus: 'stopped',
    updatedAt: new Date().toISOString(),
    ...overrides,
  })
}

const addServiceDefinition = async (elevated: Injector, id: string) => {
  const ts = new Date().toISOString()
  await getDataSetFor(elevated, ServiceDefinitionDataSet).add(elevated, {
    id,
    stackName: 'test-stack',
    displayName: `Service ${id}`,
    runCommand: 'npm start',
    createdAt: ts,
    updatedAt: ts,
  } as ServiceDefinition)
}

describe('StaleStateReconciler', () => {
  it('does nothing when there are no statuses', () =>
    withTestInjector(async ({ injector }) => {
      const { mockStatusManager } = setupMocks(injector)
      const reconciler = injector.get(StaleStateReconciler)
      await reconciler.reconcileStaleStates()

      expect(mockStatusManager.updateServiceStatus).not.toHaveBeenCalled()
    }))

  it("resets 'running' runStatus to 'stopped'", () =>
    withTestInjector(async ({ injector, elevated }) => {
      const { mockStatusManager } = setupMocks(injector)
      await addServiceStatus(elevated, { serviceId: 'svc-1', runStatus: 'running' })

      const reconciler = injector.get(StaleStateReconciler)
      await reconciler.reconcileStaleStates()

      expect(mockStatusManager.updateServiceStatus).toHaveBeenCalledWith(
        'svc-1',
        expect.objectContaining({ runStatus: 'stopped' }),
        'state-reconciled',
        { triggeredBy: 'system', triggerSource: 'system' },
        expect.objectContaining({ reason: expect.stringContaining('Stale state') }),
      )
    }))

  it("resets 'starting' runStatus to 'stopped'", () =>
    withTestInjector(async ({ injector, elevated }) => {
      const { mockStatusManager } = setupMocks(injector)
      await addServiceStatus(elevated, { serviceId: 'svc-2', runStatus: 'starting' })

      const reconciler = injector.get(StaleStateReconciler)
      await reconciler.reconcileStaleStates()

      expect(mockStatusManager.updateServiceStatus).toHaveBeenCalledWith(
        'svc-2',
        expect.objectContaining({ runStatus: 'stopped' }),
        'state-reconciled',
        expect.anything(),
        expect.anything(),
      )
    }))

  it("resets 'stopping' runStatus to 'stopped'", () =>
    withTestInjector(async ({ injector, elevated }) => {
      const { mockStatusManager } = setupMocks(injector)
      await addServiceStatus(elevated, { serviceId: 'svc-stop', runStatus: 'stopping' })

      const reconciler = injector.get(StaleStateReconciler)
      await reconciler.reconcileStaleStates()

      expect(mockStatusManager.updateServiceStatus).toHaveBeenCalledWith(
        'svc-stop',
        expect.objectContaining({ runStatus: 'stopped' }),
        'state-reconciled',
        expect.anything(),
        expect.anything(),
      )
    }))

  it("resets 'installing' installStatus to 'not-installed'", () =>
    withTestInjector(async ({ injector, elevated }) => {
      const { mockStatusManager } = setupMocks(injector)
      await addServiceStatus(elevated, { serviceId: 'svc-3', installStatus: 'installing' })

      const reconciler = injector.get(StaleStateReconciler)
      await reconciler.reconcileStaleStates()

      expect(mockStatusManager.updateServiceStatus).toHaveBeenCalledWith(
        'svc-3',
        expect.objectContaining({ installStatus: 'not-installed' }),
        'state-reconciled',
        expect.anything(),
        expect.anything(),
      )
    }))

  it("resets 'building' buildStatus to 'not-built'", () =>
    withTestInjector(async ({ injector, elevated }) => {
      const { mockStatusManager } = setupMocks(injector)
      await addServiceStatus(elevated, { serviceId: 'svc-4', buildStatus: 'building' })

      const reconciler = injector.get(StaleStateReconciler)
      await reconciler.reconcileStaleStates()

      expect(mockStatusManager.updateServiceStatus).toHaveBeenCalledWith(
        'svc-4',
        expect.objectContaining({ buildStatus: 'not-built' }),
        'state-reconciled',
        expect.anything(),
        expect.anything(),
      )
    }))

  it("resets 'cloning' cloneStatus to 'not-cloned'", () =>
    withTestInjector(async ({ injector, elevated }) => {
      const { mockStatusManager } = setupMocks(injector)
      await addServiceStatus(elevated, { serviceId: 'svc-5', cloneStatus: 'cloning' })

      const reconciler = injector.get(StaleStateReconciler)
      await reconciler.reconcileStaleStates()

      expect(mockStatusManager.updateServiceStatus).toHaveBeenCalledWith(
        'svc-5',
        expect.objectContaining({ cloneStatus: 'not-cloned' }),
        'state-reconciled',
        expect.anything(),
        expect.anything(),
      )
    }))

  it('does not update already-stable statuses', () =>
    withTestInjector(async ({ injector, elevated }) => {
      const { mockStatusManager } = setupMocks(injector)
      await addServiceStatus(elevated, {
        serviceId: 'svc-ok',
        runStatus: 'stopped',
        installStatus: 'installed',
        buildStatus: 'built',
        cloneStatus: 'not-cloned',
      })

      const reconciler = injector.get(StaleStateReconciler)
      await reconciler.reconcileStaleStates()

      expect(mockStatusManager.updateServiceStatus).not.toHaveBeenCalled()
    }))

  it("starts git watchers for 'cloned' services", () =>
    withTestInjector(async ({ injector, elevated }) => {
      const { mockGitHeadWatcher, mockGitWatcher } = setupMocks(injector)
      await addServiceStatus(elevated, { serviceId: 'svc-cloned', cloneStatus: 'cloned' })
      await addServiceDefinition(elevated, 'svc-cloned')

      const reconciler = injector.get(StaleStateReconciler)
      await reconciler.reconcileStaleStates()

      expect(vi.mocked(resolveServiceCwd)).toHaveBeenCalled()
      expect(mockGitHeadWatcher.watch).toHaveBeenCalledWith('svc-cloned', '/tmp/fake-cwd')
      expect(mockGitWatcher.startWatching).toHaveBeenCalledWith('svc-cloned')
    }))

  it('handles errors when starting git watchers gracefully', () =>
    withTestInjector(async ({ injector, elevated }) => {
      const { mockGitHeadWatcher } = setupMocks(injector)
      await addServiceStatus(elevated, { serviceId: 'svc-err', cloneStatus: 'cloned' })
      await addServiceDefinition(elevated, 'svc-err')

      mockGitHeadWatcher.watch.mockRejectedValue(new Error('git not found'))

      const reconciler = injector.get(StaleStateReconciler)
      await expect(reconciler.reconcileStaleStates()).resolves.toBeUndefined()
    }))
})
