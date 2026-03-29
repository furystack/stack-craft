import { addStore, InMemoryStore } from '@furystack/core'
import { Injector } from '@furystack/inject'
import { useLogging, VerboseConsoleLogger } from '@furystack/logging'
import { getRepository } from '@furystack/repository'
import { usingAsync } from '@furystack/utils'
import { ServiceDefinition, ServiceStatus } from 'common'
import { describe, expect, it, vi } from 'vitest'

import { GitHeadWatcher } from './git-head-watcher.js'
import { GitWatcher } from './git-watcher.js'
import { ServiceStatusManager } from './service-status-manager.js'
import { StaleStateReconciler } from './stale-state-reconciler.js'

vi.mock('../utils/resolve-service-cwd.js', () => ({
  resolveServiceCwd: vi.fn().mockResolvedValue('/tmp/fake-cwd'),
}))

const setupReconcilerInjector = (injector: Injector) => {
  useLogging(injector, VerboseConsoleLogger)

  const statusStore = new InMemoryStore({ model: ServiceStatus, primaryKey: 'serviceId' })
  addStore(injector, statusStore)
  getRepository(injector).createDataSet(ServiceStatus, 'serviceId', {})

  const svcDefStore = new InMemoryStore({ model: ServiceDefinition, primaryKey: 'id' })
  addStore(injector, svcDefStore)
  getRepository(injector).createDataSet(ServiceDefinition, 'id', {})

  const mockStatusManager = { updateServiceStatus: vi.fn().mockResolvedValue(undefined) }
  injector.setExplicitInstance(mockStatusManager as unknown as ServiceStatusManager, ServiceStatusManager)

  const mockGitHeadWatcher = { watch: vi.fn().mockResolvedValue(undefined) }
  injector.setExplicitInstance(mockGitHeadWatcher as unknown as GitHeadWatcher, GitHeadWatcher)

  const mockGitWatcher = { startWatching: vi.fn().mockResolvedValue(undefined) }
  injector.setExplicitInstance(mockGitWatcher as unknown as GitWatcher, GitWatcher)

  return { statusStore, svcDefStore, mockStatusManager, mockGitHeadWatcher, mockGitWatcher }
}

const addServiceStatus = async (
  statusStore: InMemoryStore<ServiceStatus, 'serviceId'>,
  overrides: Partial<ServiceStatus> & { serviceId: string },
) => {
  await statusStore.add({
    cloneStatus: 'not-cloned',
    installStatus: 'not-installed',
    buildStatus: 'not-built',
    runStatus: 'stopped',
    updatedAt: new Date().toISOString(),
    ...overrides,
  } as ServiceStatus)
}

const addServiceDefinition = async (svcDefStore: InMemoryStore<ServiceDefinition, 'id'>, id: string) => {
  const ts = new Date().toISOString()
  await svcDefStore.add({
    id,
    stackName: 'test-stack',
    displayName: `Service ${id}`,
    runCommand: 'npm start',
    createdAt: ts,
    updatedAt: ts,
  } as ServiceDefinition)
}

describe('StaleStateReconciler', () => {
  it('should reset stale runStatus from running to stopped', () =>
    usingAsync(new Injector(), async (injector) => {
      const { statusStore, mockStatusManager } = setupReconcilerInjector(injector)
      await addServiceStatus(statusStore, { serviceId: 'svc-1', runStatus: 'running' })

      const reconciler = injector.getInstance(StaleStateReconciler)
      await reconciler.reconcileStaleStates()

      expect(mockStatusManager.updateServiceStatus).toHaveBeenCalledWith(
        'svc-1',
        expect.objectContaining({ runStatus: 'stopped' }),
        'state-reconciled',
        { triggeredBy: 'system', triggerSource: 'system' },
        expect.objectContaining({ reason: expect.stringContaining('Stale state') }),
      )
    }))

  it('should reset stale runStatus from starting to stopped', () =>
    usingAsync(new Injector(), async (injector) => {
      const { statusStore, mockStatusManager } = setupReconcilerInjector(injector)
      await addServiceStatus(statusStore, { serviceId: 'svc-2', runStatus: 'starting' })

      const reconciler = injector.getInstance(StaleStateReconciler)
      await reconciler.reconcileStaleStates()

      expect(mockStatusManager.updateServiceStatus).toHaveBeenCalledWith(
        'svc-2',
        expect.objectContaining({ runStatus: 'stopped' }),
        'state-reconciled',
        expect.anything(),
        expect.anything(),
      )
    }))

  it('should reset stale installStatus from installing to not-installed', () =>
    usingAsync(new Injector(), async (injector) => {
      const { statusStore, mockStatusManager } = setupReconcilerInjector(injector)
      await addServiceStatus(statusStore, { serviceId: 'svc-3', installStatus: 'installing' })

      const reconciler = injector.getInstance(StaleStateReconciler)
      await reconciler.reconcileStaleStates()

      expect(mockStatusManager.updateServiceStatus).toHaveBeenCalledWith(
        'svc-3',
        expect.objectContaining({ installStatus: 'not-installed' }),
        'state-reconciled',
        expect.anything(),
        expect.anything(),
      )
    }))

  it('should reset stale buildStatus from building to not-built', () =>
    usingAsync(new Injector(), async (injector) => {
      const { statusStore, mockStatusManager } = setupReconcilerInjector(injector)
      await addServiceStatus(statusStore, { serviceId: 'svc-4', buildStatus: 'building' })

      const reconciler = injector.getInstance(StaleStateReconciler)
      await reconciler.reconcileStaleStates()

      expect(mockStatusManager.updateServiceStatus).toHaveBeenCalledWith(
        'svc-4',
        expect.objectContaining({ buildStatus: 'not-built' }),
        'state-reconciled',
        expect.anything(),
        expect.anything(),
      )
    }))

  it('should reset stale cloneStatus from cloning to not-cloned', () =>
    usingAsync(new Injector(), async (injector) => {
      const { statusStore, mockStatusManager } = setupReconcilerInjector(injector)
      await addServiceStatus(statusStore, { serviceId: 'svc-5', cloneStatus: 'cloning' })

      const reconciler = injector.getInstance(StaleStateReconciler)
      await reconciler.reconcileStaleStates()

      expect(mockStatusManager.updateServiceStatus).toHaveBeenCalledWith(
        'svc-5',
        expect.objectContaining({ cloneStatus: 'not-cloned' }),
        'state-reconciled',
        expect.anything(),
        expect.anything(),
      )
    }))

  it('should not call updateServiceStatus for non-stale statuses', () =>
    usingAsync(new Injector(), async (injector) => {
      const { statusStore, mockStatusManager } = setupReconcilerInjector(injector)
      await addServiceStatus(statusStore, { serviceId: 'svc-ok', runStatus: 'stopped', installStatus: 'installed' })

      const reconciler = injector.getInstance(StaleStateReconciler)
      await reconciler.reconcileStaleStates()

      expect(mockStatusManager.updateServiceStatus).not.toHaveBeenCalled()
    }))

  it('should start git watchers for cloned services', () =>
    usingAsync(new Injector(), async (injector) => {
      const { statusStore, svcDefStore, mockGitHeadWatcher, mockGitWatcher } = setupReconcilerInjector(injector)
      await addServiceStatus(statusStore, { serviceId: 'svc-cloned', cloneStatus: 'cloned' })
      await addServiceDefinition(svcDefStore, 'svc-cloned')

      const reconciler = injector.getInstance(StaleStateReconciler)
      await reconciler.reconcileStaleStates()

      expect(mockGitHeadWatcher.watch).toHaveBeenCalledWith('svc-cloned', '/tmp/fake-cwd')
      expect(mockGitWatcher.startWatching).toHaveBeenCalledWith('svc-cloned')
    }))

  it('should handle multiple stale fields in one status', () =>
    usingAsync(new Injector(), async (injector) => {
      const { statusStore, mockStatusManager } = setupReconcilerInjector(injector)
      await addServiceStatus(statusStore, {
        serviceId: 'svc-multi',
        runStatus: 'running',
        buildStatus: 'building',
        installStatus: 'installing',
      })

      const reconciler = injector.getInstance(StaleStateReconciler)
      await reconciler.reconcileStaleStates()

      expect(mockStatusManager.updateServiceStatus).toHaveBeenCalledWith(
        'svc-multi',
        expect.objectContaining({
          runStatus: 'stopped',
          buildStatus: 'not-built',
          installStatus: 'not-installed',
        }),
        'state-reconciled',
        expect.anything(),
        expect.anything(),
      )
    }))

  it('should gracefully handle git watcher errors for cloned services', () =>
    usingAsync(new Injector(), async (injector) => {
      const { statusStore, svcDefStore, mockGitHeadWatcher } = setupReconcilerInjector(injector)
      await addServiceStatus(statusStore, { serviceId: 'svc-err', cloneStatus: 'cloned' })
      await addServiceDefinition(svcDefStore, 'svc-err')

      mockGitHeadWatcher.watch.mockRejectedValue(new Error('git not found'))

      const reconciler = injector.getInstance(StaleStateReconciler)
      await expect(reconciler.reconcileStaleStates()).resolves.toBeUndefined()
    }))
})
