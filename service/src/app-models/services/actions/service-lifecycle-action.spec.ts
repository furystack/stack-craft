import { addStore, InMemoryStore, useSystemIdentityContext } from '@furystack/core'
import { Injector } from '@furystack/inject'
import { useLogging, VerboseConsoleLogger } from '@furystack/logging'
import { getRepository } from '@furystack/repository'
import { GitHubRepository, ServiceDefinition, ServiceStateHistory, ServiceStatus, StackConfig } from 'common'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { ServiceLifecycleAction } from './service-lifecycle-action.js'
import { ProcessManager } from '../../../services/process-manager.js'
import { GitService } from '../../../services/git-service.js'

const createMockActionContext = <TBody = unknown, TUrl = Record<string, string>>(options: {
  injector: Injector
  body?: TBody
  urlParams?: TUrl
}) => ({
  injector: options.injector,
  getBody: () => Promise.resolve(options.body as TBody),
  getUrlParams: () => (options.urlParams ?? {}) as TUrl,
  getQuery: () => ({}) as never,
  request: {} as never,
  response: {} as never,
})

describe('ServiceLifecycleAction', () => {
  let injector: Injector
  let mockPm: {
    startService: ReturnType<typeof vi.fn>
    stopService: ReturnType<typeof vi.fn>
    restartService: ReturnType<typeof vi.fn>
    installService: ReturnType<typeof vi.fn>
    buildService: ReturnType<typeof vi.fn>
  }

  beforeEach(async () => {
    injector = new Injector()
    useLogging(injector, VerboseConsoleLogger)

    addStore(injector, new InMemoryStore({ model: ServiceDefinition, primaryKey: 'id' }))
    addStore(injector, new InMemoryStore({ model: StackConfig, primaryKey: 'stackName' }))
    addStore(injector, new InMemoryStore({ model: GitHubRepository, primaryKey: 'id' }))
    addStore(injector, new InMemoryStore({ model: ServiceStatus, primaryKey: 'serviceId' }))
    addStore(injector, new InMemoryStore({ model: ServiceStateHistory, primaryKey: 'id' }))

    getRepository(injector).createDataSet(ServiceDefinition, 'id', {})
    getRepository(injector).createDataSet(StackConfig, 'stackName', {})
    getRepository(injector).createDataSet(GitHubRepository, 'id', {})
    getRepository(injector).createDataSet(ServiceStatus, 'serviceId', {})
    getRepository(injector).createDataSet(ServiceStateHistory, 'id', {})

    mockPm = {
      startService: vi.fn().mockResolvedValue(undefined),
      stopService: vi.fn().mockResolvedValue(undefined),
      restartService: vi.fn().mockResolvedValue(undefined),
      installService: vi.fn().mockResolvedValue(undefined),
      buildService: vi.fn().mockResolvedValue(undefined),
    }
    injector.setExplicitInstance(mockPm as unknown as ProcessManager, ProcessManager)

    const mockGit = {
      clone: vi.fn().mockResolvedValue(undefined),
      pull: vi.fn().mockResolvedValue({ updated: true }),
    }
    injector.setExplicitInstance(mockGit as unknown as GitService, GitService)
  })

  afterEach(async () => {
    await injector[Symbol.asyncDispose]()
  })

  describe('start/stop/restart/install/build delegation', () => {
    it('should delegate "start" to ProcessManager.startService', async () => {
      const action = ServiceLifecycleAction('start')
      const ctx = createMockActionContext({ injector, urlParams: { id: 'svc-1' } })
      const result = await action(ctx)
      const body = result.chunk as { success: boolean; serviceId: string }

      expect(body.success).toBe(true)
      expect(body.serviceId).toBe('svc-1')
      expect(mockPm.startService).toHaveBeenCalledWith('svc-1', expect.objectContaining({ triggerSource: 'api' }))
    })

    it('should delegate "stop" to ProcessManager.stopService', async () => {
      const action = ServiceLifecycleAction('stop')
      await action(createMockActionContext({ injector, urlParams: { id: 'svc-2' } }))
      expect(mockPm.stopService).toHaveBeenCalledWith('svc-2', expect.objectContaining({ triggerSource: 'api' }))
    })

    it('should delegate "restart" to ProcessManager.restartService', async () => {
      const action = ServiceLifecycleAction('restart')
      await action(createMockActionContext({ injector, urlParams: { id: 'svc-3' } }))
      expect(mockPm.restartService).toHaveBeenCalledWith('svc-3', expect.objectContaining({ triggerSource: 'api' }))
    })

    it('should delegate "install" to ProcessManager.installService', async () => {
      const action = ServiceLifecycleAction('install')
      await action(createMockActionContext({ injector, urlParams: { id: 'svc-4' } }))
      expect(mockPm.installService).toHaveBeenCalledWith('svc-4', expect.objectContaining({ triggerSource: 'api' }))
    })

    it('should delegate "build" to ProcessManager.buildService', async () => {
      const action = ServiceLifecycleAction('build')
      await action(createMockActionContext({ injector, urlParams: { id: 'svc-5' } }))
      expect(mockPm.buildService).toHaveBeenCalledWith('svc-5', expect.objectContaining({ triggerSource: 'api' }))
    })

    it('should wrap ProcessManager errors into RequestError', async () => {
      mockPm.startService.mockRejectedValue(new Error('Service not found: svc-bad'))
      const action = ServiceLifecycleAction('start')
      await expect(action(createMockActionContext({ injector, urlParams: { id: 'svc-bad' } }))).rejects.toThrow(
        'Service not found: svc-bad',
      )
    })
  })

  describe('pull action', () => {
    it('should throw 404 when service does not exist', async () => {
      const action = ServiceLifecycleAction('pull')
      await expect(action(createMockActionContext({ injector, urlParams: { id: 'nonexistent' } }))).rejects.toThrow(
        'Service not found',
      )
    })

    it('should throw 400 when no repository is linked', async () => {
      const elevated = useSystemIdentityContext({ injector })
      const ts = new Date().toISOString()
      await getRepository(elevated).getDataSetFor(StackConfig, 'stackName').add(elevated, {
        stackName: 'test-stack',
        mainDirectory: '/tmp/test',
        createdAt: ts,
        updatedAt: ts,
      })
      await getRepository(elevated).getDataSetFor(ServiceDefinition, 'id').add(elevated, {
        id: 'no-repo-svc',
        stackName: 'test-stack',
        displayName: 'No Repo',
        description: '',
        runCommand: 'echo hi',
        dependencyIds: [],
        prerequisiteServiceIds: [],
        createdAt: ts,
        updatedAt: ts,
      })
      await elevated[Symbol.asyncDispose]()

      const action = ServiceLifecycleAction('pull')
      await expect(action(createMockActionContext({ injector, urlParams: { id: 'no-repo-svc' } }))).rejects.toThrow(
        'No repository linked',
      )
    })

    it('should reject path traversal attempts', async () => {
      const elevated = useSystemIdentityContext({ injector })
      const ts = new Date().toISOString()
      await getRepository(elevated).getDataSetFor(StackConfig, 'stackName').add(elevated, {
        stackName: 'traversal-stack',
        mainDirectory: '/tmp/safe',
        createdAt: ts,
        updatedAt: ts,
      })
      await getRepository(elevated).getDataSetFor(GitHubRepository, 'id').add(elevated, {
        id: 'repo-1',
        stackName: 'traversal-stack',
        url: 'https://github.com/test/repo',
        displayName: 'Repo',
        description: '',
        createdAt: ts,
        updatedAt: ts,
      })
      await getRepository(elevated).getDataSetFor(ServiceDefinition, 'id').add(elevated, {
        id: 'traversal-svc',
        stackName: 'traversal-stack',
        displayName: 'Traversal',
        description: '',
        workingDirectory: '../../etc',
        repositoryId: 'repo-1',
        runCommand: 'echo hi',
        dependencyIds: [],
        prerequisiteServiceIds: [],
        createdAt: ts,
        updatedAt: ts,
      })
      await elevated[Symbol.asyncDispose]()

      const action = ServiceLifecycleAction('pull')
      await expect(action(createMockActionContext({ injector, urlParams: { id: 'traversal-svc' } }))).rejects.toThrow(
        'outside the stack directory',
      )
    })
  })
})
