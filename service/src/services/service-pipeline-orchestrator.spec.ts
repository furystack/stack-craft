import { ServiceDependencyLinkDataSet, ServiceStatusDataSet } from '../app-models/data-store/tokens.js'
import { getDataSetFor } from '@furystack/repository'
import type { Injector } from '@furystack/inject'
import { ServiceDefinition, ServiceStatus, StackConfig } from 'common'
import { tmpdir } from 'os'
import { join } from 'path'
import { describe, expect, it, vi } from 'vitest'
import { withTestInjector } from '../test-helpers.js'
import { GitOperationsService } from './git-operations-service.js'
import { OneShotCommandRunner } from './one-shot-command-runner.js'
import { ServiceLifecycleManager } from './service-lifecycle-manager.js'
import { ServicePipelineOrchestrator } from './service-pipeline-orchestrator.js'
import { ServiceStatusManager } from './service-status-manager.js'
import type { TriggerContext } from './trigger-context.js'
import { legacyRepository as getRepository } from '../utils/legacy-repository.js'
import '../test-shims.js'
const testTrigger: TriggerContext = { triggeredBy: 'test', triggerSource: 'api' }
const ts = new Date().toISOString()

const setupMocks = (injector: Injector) => {
  const mockStatusManager = { updateServiceStatus: vi.fn().mockResolvedValue(undefined) }
  injector.setExplicitInstance(mockStatusManager as unknown as ServiceStatusManager, ServiceStatusManager)

  const mockLifecycle = {
    startService: vi.fn().mockResolvedValue(undefined),
    stopService: vi.fn().mockResolvedValue(undefined),
    restartService: vi.fn().mockResolvedValue(undefined),
  }
  injector.setExplicitInstance(mockLifecycle as unknown as ServiceLifecycleManager, ServiceLifecycleManager)

  const mockOneShotRunner = {
    installService: vi.fn().mockResolvedValue(undefined),
    buildService: vi.fn().mockResolvedValue(undefined),
  }
  injector.setExplicitInstance(mockOneShotRunner as unknown as OneShotCommandRunner, OneShotCommandRunner)

  const mockGitOps = {
    cloneOrPullService: vi.fn().mockResolvedValue({ cloned: false, pulled: true, updated: true }),
  }
  injector.setExplicitInstance(mockGitOps as unknown as GitOperationsService, GitOperationsService)

  return { mockStatusManager, mockLifecycle, mockOneShotRunner, mockGitOps }
}

const seedService = async (elevated: Injector, overrides: Partial<ServiceDefinition> & { id: string }) => {
  const repo = getRepository(elevated)

  const existing = await repo.getDataSetFor(StackConfig, 'stackName').find(elevated, {
    filter: { stackName: { $eq: 'test-stack' } },
    top: 1,
  })
  if (existing.length === 0) {
    await repo.getDataSetFor(StackConfig, 'stackName').add(elevated, {
      stackName: 'test-stack',
      mainDirectory: join(tmpdir(), 'stacks', 'test'),
      environmentVariables: {},
      createdAt: ts,
      updatedAt: ts,
    })
  }

  await repo.getDataSetFor(ServiceDefinition, 'id').add(elevated, {
    stackName: 'test-stack',
    displayName: `Service ${overrides.id}`,
    runCommand: 'npm start',
    installCommand: 'npm install',
    buildCommand: 'npm run build',
    files: [],
    createdAt: ts,
    updatedAt: ts,
    ...overrides,
  } as ServiceDefinition)
  await repo.getDataSetFor(ServiceStatus, 'serviceId').add(elevated, {
    serviceId: overrides.id,
    cloneStatus: 'not-cloned',
    installStatus: 'not-installed',
    buildStatus: 'not-built',
    runStatus: 'stopped',
    updatedAt: ts,
  })
}

describe('ServicePipelineOrchestrator', () => {
  describe('setupService', () => {
    it('should run install and build when no repo is linked', () =>
      withTestInjector(async ({ injector, elevated }) => {
        const { mockOneShotRunner, mockGitOps, mockStatusManager } = setupMocks(injector)
        await seedService(elevated, { id: 'svc-1', repositoryId: undefined })

        const orchestrator = injector.get(ServicePipelineOrchestrator)
        await orchestrator.setupService('svc-1', testTrigger)

        expect(mockGitOps.cloneOrPullService).not.toHaveBeenCalled()
        expect(mockOneShotRunner.installService).toHaveBeenCalledWith('svc-1', testTrigger)
        expect(mockOneShotRunner.buildService).toHaveBeenCalledWith('svc-1', testTrigger)
        expect(mockStatusManager.updateServiceStatus).toHaveBeenCalledWith('svc-1', {}, 'setup-started', testTrigger)
        expect(mockStatusManager.updateServiceStatus).toHaveBeenCalledWith('svc-1', {}, 'setup-completed', testTrigger)
      }))

    it('should skip install when no installCommand', () =>
      withTestInjector(async ({ injector, elevated }) => {
        const { mockOneShotRunner } = setupMocks(injector)
        await seedService(elevated, { id: 'svc-1', installCommand: undefined })

        const orchestrator = injector.get(ServicePipelineOrchestrator)
        await orchestrator.setupService('svc-1', testTrigger)

        expect(mockOneShotRunner.installService).not.toHaveBeenCalled()
        expect(mockOneShotRunner.buildService).toHaveBeenCalledWith('svc-1', testTrigger)
      }))

    it('should skip build when no buildCommand', () =>
      withTestInjector(async ({ injector, elevated }) => {
        const { mockOneShotRunner } = setupMocks(injector)
        await seedService(elevated, { id: 'svc-1', buildCommand: undefined })

        const orchestrator = injector.get(ServicePipelineOrchestrator)
        await orchestrator.setupService('svc-1', testTrigger)

        expect(mockOneShotRunner.installService).toHaveBeenCalledWith('svc-1', testTrigger)
        expect(mockOneShotRunner.buildService).not.toHaveBeenCalled()
      }))

    it('should clone when repo is linked and not yet cloned', () =>
      withTestInjector(async ({ injector, elevated }) => {
        const { mockGitOps } = setupMocks(injector)
        await seedService(elevated, { id: 'svc-1', repositoryId: 'repo-1' })

        const orchestrator = injector.get(ServicePipelineOrchestrator)
        await orchestrator.setupService('svc-1', testTrigger)

        expect(mockGitOps.cloneOrPullService).toHaveBeenCalledWith('svc-1', testTrigger)
      }))

    it('should skip clone when already cloned', () =>
      withTestInjector(async ({ injector, elevated }) => {
        const { mockGitOps } = setupMocks(injector)
        await seedService(elevated, { id: 'svc-1', repositoryId: 'repo-1' })
        await getDataSetFor(elevated, ServiceStatusDataSet).update(elevated, 'svc-1', {
          cloneStatus: 'cloned',
        })

        const orchestrator = injector.get(ServicePipelineOrchestrator)
        await orchestrator.setupService('svc-1', testTrigger)

        expect(mockGitOps.cloneOrPullService).not.toHaveBeenCalled()
      }))

    it('should throw for non-existent service', () =>
      withTestInjector(async ({ injector }) => {
        setupMocks(injector)

        const orchestrator = injector.get(ServicePipelineOrchestrator)
        await expect(orchestrator.setupService('nonexistent', testTrigger)).rejects.toThrow('Service not found')
      }))

    it('should emit setup-failed when a step throws', () =>
      withTestInjector(async ({ injector, elevated }) => {
        const { mockOneShotRunner, mockStatusManager } = setupMocks(injector)
        await seedService(elevated, { id: 'svc-1' })

        mockOneShotRunner.installService.mockRejectedValueOnce(new Error('install boom'))

        const orchestrator = injector.get(ServicePipelineOrchestrator)
        await expect(orchestrator.setupService('svc-1', testTrigger)).rejects.toThrow('install boom')

        expect(mockStatusManager.updateServiceStatus).toHaveBeenCalledWith('svc-1', {}, 'setup-failed', testTrigger, {
          error: 'install boom',
        })
      }))
  })

  describe('updateService', () => {
    it('should throw when no repository is linked', () =>
      withTestInjector(async ({ injector, elevated }) => {
        const { mockStatusManager } = setupMocks(injector)
        await seedService(elevated, { id: 'svc-1', repositoryId: undefined })

        const orchestrator = injector.get(ServicePipelineOrchestrator)
        await expect(orchestrator.updateService('svc-1', testTrigger)).rejects.toThrow('No repository linked')

        expect(mockStatusManager.updateServiceStatus).toHaveBeenCalledWith(
          'svc-1',
          {},
          'update-failed',
          testTrigger,
          expect.objectContaining({ error: expect.stringContaining('No repository linked') }),
        )
      }))

    it('should skip install/build/restart when already up to date', () =>
      withTestInjector(async ({ injector, elevated }) => {
        const { mockGitOps, mockOneShotRunner, mockLifecycle, mockStatusManager } = setupMocks(injector)
        await seedService(elevated, { id: 'svc-1', repositoryId: 'repo-1' })

        mockGitOps.cloneOrPullService.mockResolvedValueOnce({ cloned: false, pulled: true, updated: false })

        const orchestrator = injector.get(ServicePipelineOrchestrator)
        await orchestrator.updateService('svc-1', testTrigger)

        expect(mockOneShotRunner.installService).not.toHaveBeenCalled()
        expect(mockOneShotRunner.buildService).not.toHaveBeenCalled()
        expect(mockLifecycle.stopService).not.toHaveBeenCalled()
        expect(mockLifecycle.startService).not.toHaveBeenCalled()
        expect(mockStatusManager.updateServiceStatus).toHaveBeenCalledWith(
          'svc-1',
          {},
          'update-completed',
          testTrigger,
          { message: 'Already up to date' },
        )
      }))

    it('should stop, install, build, and restart when service was running and updated', () =>
      withTestInjector(async ({ injector, elevated }) => {
        const { mockGitOps, mockOneShotRunner, mockLifecycle } = setupMocks(injector)
        await seedService(elevated, { id: 'svc-1', repositoryId: 'repo-1' })
        await getDataSetFor(elevated, ServiceStatusDataSet).update(elevated, 'svc-1', {
          runStatus: 'running',
        })

        mockGitOps.cloneOrPullService.mockResolvedValueOnce({ cloned: false, pulled: true, updated: true })

        const orchestrator = injector.get(ServicePipelineOrchestrator)
        await orchestrator.updateService('svc-1', testTrigger)

        expect(mockLifecycle.stopService).toHaveBeenCalledWith('svc-1', testTrigger)
        expect(mockOneShotRunner.installService).toHaveBeenCalledWith('svc-1', testTrigger)
        expect(mockOneShotRunner.buildService).toHaveBeenCalledWith('svc-1', testTrigger)
        expect(mockLifecycle.startService).toHaveBeenCalledWith('svc-1', testTrigger)
      }))

    it('should not stop/restart when service was not running', () =>
      withTestInjector(async ({ injector, elevated }) => {
        const { mockGitOps, mockOneShotRunner, mockLifecycle } = setupMocks(injector)
        await seedService(elevated, { id: 'svc-1', repositoryId: 'repo-1' })

        mockGitOps.cloneOrPullService.mockResolvedValueOnce({ cloned: false, pulled: true, updated: true })

        const orchestrator = injector.get(ServicePipelineOrchestrator)
        await orchestrator.updateService('svc-1', testTrigger)

        expect(mockLifecycle.stopService).not.toHaveBeenCalled()
        expect(mockOneShotRunner.installService).toHaveBeenCalled()
        expect(mockOneShotRunner.buildService).toHaveBeenCalled()
        expect(mockLifecycle.startService).not.toHaveBeenCalled()
      }))
  })

  describe('setupServices (batch)', () => {
    it('should set up multiple independent services', () =>
      withTestInjector(async ({ injector, elevated }) => {
        const { mockOneShotRunner } = setupMocks(injector)
        await seedService(elevated, { id: 'batch-a', repositoryId: undefined })
        await seedService(elevated, { id: 'batch-b', repositoryId: undefined })

        const orchestrator = injector.get(ServicePipelineOrchestrator)
        await orchestrator.setupServices(['batch-a', 'batch-b'], testTrigger)

        expect(mockOneShotRunner.installService).toHaveBeenCalledWith('batch-a', testTrigger)
        expect(mockOneShotRunner.installService).toHaveBeenCalledWith('batch-b', testTrigger)
      }))

    it('should respect prerequisite ordering', () =>
      withTestInjector(async ({ injector, elevated }) => {
        setupMocks(injector)
        await seedService(elevated, { id: 'dep-parent', repositoryId: undefined, buildCommand: undefined })
        await seedService(elevated, { id: 'dep-child', repositoryId: undefined, buildCommand: undefined })

        await getDataSetFor(elevated, ServiceDependencyLinkDataSet).add(elevated, {
          id: 'dep-child::dep-parent',
          serviceId: 'dep-child',
          dependsOnServiceId: 'dep-parent',
        })

        const order: string[] = []
        const orchestrator = injector.get(ServicePipelineOrchestrator)
        const origSetup = orchestrator.setupService.bind(orchestrator)
        vi.spyOn(orchestrator, 'setupService').mockImplementation(async (id, trigger) => {
          order.push(id)
          return origSetup(id, trigger)
        })

        await orchestrator.setupServices(['dep-child', 'dep-parent'], testTrigger)

        const parentIdx = order.indexOf('dep-parent')
        const childIdx = order.indexOf('dep-child')
        expect(parentIdx).toBeLessThan(childIdx)
      }))

    it('should continue other services when one fails in a batch level', () =>
      withTestInjector(async ({ injector, elevated }) => {
        const { mockOneShotRunner } = setupMocks(injector)
        await seedService(elevated, { id: 'ok-svc', repositoryId: undefined, buildCommand: undefined })
        await seedService(elevated, { id: 'fail-svc', repositoryId: undefined, buildCommand: undefined })

        mockOneShotRunner.installService.mockImplementation(async (id: string) => {
          if (id === 'fail-svc') throw new Error('install failed')
        })

        const orchestrator = injector.get(ServicePipelineOrchestrator)
        await orchestrator.setupServices(['ok-svc', 'fail-svc'], testTrigger)

        expect(mockOneShotRunner.installService).toHaveBeenCalledWith('ok-svc', testTrigger)
        expect(mockOneShotRunner.installService).toHaveBeenCalledWith('fail-svc', testTrigger)
      }))
  })
})
