import { addStore, InMemoryStore } from '@furystack/core'
import { Injector } from '@furystack/inject'
import { useLogging, VerboseConsoleLogger } from '@furystack/logging'
import { getRepository } from '@furystack/repository'
import { RequestError } from '@furystack/rest'
import { GitHubRepository, ServiceDefinition, ServiceStatus, StackConfig } from 'common'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { GitService } from '../../../services/git-service.js'
import { ServiceBranchesAction } from './service-branches-action.js'

const createMockActionContext = (options: { injector: Injector; urlParams?: Record<string, string> }) => ({
  injector: options.injector,
  getBody: () => Promise.resolve({} as never),
  getUrlParams: () => (options.urlParams ?? {}) as { id: string },
  getQuery: () => ({}) as never,
  request: {} as never,
  response: {} as never,
})

describe('ServiceBranchesAction', () => {
  let injector: Injector
  let mockGit: { getCurrentBranch: ReturnType<typeof vi.fn>; getBranches: ReturnType<typeof vi.fn> }

  beforeEach(async () => {
    injector = new Injector()
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

    mockGit = {
      getCurrentBranch: vi.fn().mockResolvedValue('main'),
      getBranches: vi.fn().mockResolvedValue({ local: ['main', 'dev'], remote: ['origin/main'] }),
    }
    injector.setExplicitInstance(mockGit as unknown as GitService, GitService)
  })

  afterEach(async () => {
    await injector[Symbol.asyncDispose]()
  })

  it('should throw 404 when service not found', async () => {
    const ctx = createMockActionContext({ injector, urlParams: { id: 'nonexistent' } })
    await expect(ServiceBranchesAction(ctx)).rejects.toThrow(RequestError)
  })

  it('should throw 400 when service is not cloned', async () => {
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
    await expect(ServiceBranchesAction(ctx)).rejects.toThrow('Repository is not cloned yet')
  })

  it('should return branches when service is cloned', async () => {
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

    const ctx = createMockActionContext({ injector, urlParams: { id: 'svc-1' } })
    const result = await ServiceBranchesAction(ctx)
    const body = result.chunk as { currentBranch: string; local: string[]; remote: string[] }

    expect(body.currentBranch).toBe('main')
    expect(body.local).toEqual(['main', 'dev'])
    expect(body.remote).toEqual(['origin/main'])
  })
})
