import { addStore, InMemoryStore } from '@furystack/core'
import { Injector } from '@furystack/inject'
import { useLogging, VerboseConsoleLogger } from '@furystack/logging'
import { getRepository } from '@furystack/repository'
import { RequestError } from '@furystack/rest'
import { usingAsync } from '@furystack/utils'
import { GitHubRepository, ServiceDefinition, ServiceStatus, StackConfig } from 'common'
import { describe, expect, it, vi } from 'vitest'

import { GitService } from '../../../services/git-service.js'
import { ServiceCheckoutAction } from './service-checkout-action.js'

const createMockActionContext = (options: {
  injector: Injector
  urlParams?: Record<string, string>
  body?: { branch: string }
}) => ({
  injector: options.injector,
  getBody: () => Promise.resolve(options.body ?? { branch: 'dev' }),
  getUrlParams: () => (options.urlParams ?? {}) as { id: string },
  getQuery: () => ({}) as never,
  request: {} as never,
  response: {} as never,
})

const createSetup = () => {
  const injector = new Injector()
  useLogging(injector, VerboseConsoleLogger)

  addStore(injector, new InMemoryStore({ model: ServiceDefinition, primaryKey: 'id' }))
  addStore(injector, new InMemoryStore({ model: ServiceStatus, primaryKey: 'serviceId' }))
  addStore(injector, new InMemoryStore({ model: StackConfig, primaryKey: 'stackName' }))
  addStore(injector, new InMemoryStore({ model: GitHubRepository, primaryKey: 'id' }))

  const repo = getRepository(injector)
  repo.createDataSet(ServiceDefinition, 'id')
  repo.createDataSet(ServiceStatus, 'serviceId')
  repo.createDataSet(StackConfig, 'stackName')
  repo.createDataSet(GitHubRepository, 'id')

  const mockGit = {
    checkout: vi.fn().mockResolvedValue(undefined),
    getCurrentBranch: vi.fn().mockResolvedValue('dev'),
  }
  injector.setExplicitInstance(mockGit as unknown as GitService, GitService)

  return { injector, mockGit }
}

describe('ServiceCheckoutAction', () => {
  it('should throw 404 when service not found', async () => {
    const { injector } = createSetup()
    await usingAsync(injector, async () => {
      const ctx = createMockActionContext({ injector, urlParams: { id: 'nonexistent' } })
      await expect(ServiceCheckoutAction(ctx)).rejects.toThrow(RequestError)
    })
  })

  it('should throw 400 when not cloned', async () => {
    const { injector } = createSetup()
    await usingAsync(injector, async () => {
      const ds = getRepository(injector).getDataSetFor(ServiceDefinition, 'id')
      await ds.add(injector, {
        id: 'svc-1',
        stackName: 'stack-1',
        displayName: 'Test',
        description: '',
        runCommand: 'npm start',
        prerequisiteIds: [],
        prerequisiteServiceIds: [],
        files: [],
        createdAt: '',
        updatedAt: '',
      })
      const statusDs = getRepository(injector).getDataSetFor(ServiceStatus, 'serviceId')
      await statusDs.add(injector, {
        serviceId: 'svc-1',
        cloneStatus: 'not-cloned',
        installStatus: 'not-installed',
        buildStatus: 'not-built',
        runStatus: 'stopped',
        updatedAt: '',
      })

      const ctx = createMockActionContext({ injector, urlParams: { id: 'svc-1' } })
      await expect(ServiceCheckoutAction(ctx)).rejects.toThrow('Repository is not cloned yet')
    })
  })

  it('should checkout branch and update status when cloned', async () => {
    const { injector, mockGit } = createSetup()
    await usingAsync(injector, async () => {
      const repo = getRepository(injector)
      await repo.getDataSetFor(StackConfig, 'stackName').add(injector, {
        stackName: 'stack-1',
        mainDirectory: '/tmp/stacks',
        environmentVariables: {},
        createdAt: '',
        updatedAt: '',
      })
      const ds = repo.getDataSetFor(ServiceDefinition, 'id')
      await ds.add(injector, {
        id: 'svc-1',
        stackName: 'stack-1',
        displayName: 'Test',
        description: '',
        runCommand: 'npm start',
        prerequisiteIds: [],
        prerequisiteServiceIds: [],
        files: [],
        createdAt: '',
        updatedAt: '',
      })
      const statusDs = repo.getDataSetFor(ServiceStatus, 'serviceId')
      await statusDs.add(injector, {
        serviceId: 'svc-1',
        cloneStatus: 'cloned',
        installStatus: 'not-installed',
        buildStatus: 'not-built',
        runStatus: 'stopped',
        updatedAt: '',
      })

      const ctx = createMockActionContext({ injector, urlParams: { id: 'svc-1' }, body: { branch: 'dev' } })
      const result = await ServiceCheckoutAction(ctx)
      const body = result.chunk as { success: boolean; serviceId: string }

      expect(body.success).toBe(true)
      expect(body.serviceId).toBe('svc-1')
      expect(mockGit.checkout).toHaveBeenCalledWith(expect.any(String), 'dev')
    })
  })
})
