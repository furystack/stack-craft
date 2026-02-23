import { addStore, InMemoryStore, useSystemIdentityContext } from '@furystack/core'
import { Injector } from '@furystack/inject'
import { useLogging, VerboseConsoleLogger } from '@furystack/logging'
import { getRepository } from '@furystack/repository'
import {
  GitHubRepository,
  Prerequisite,
  ServiceConfig,
  ServiceDefinition,
  ServiceStateHistory,
  ServiceStatus,
  StackConfig,
  StackDefinition,
} from 'common'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { ExportStackAction } from './export-stack-action.js'
import { ImportStackAction } from './import-stack-action.js'

const now = () => new Date().toISOString()

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

describe('Import/Export Stack Actions', () => {
  let injector: Injector
  let stackDefStore: InMemoryStore<StackDefinition, 'name'>
  let stackConfigStore: InMemoryStore<StackConfig, 'stackName'>
  let serviceDefStore: InMemoryStore<ServiceDefinition, 'id'>
  let serviceConfigStore: InMemoryStore<ServiceConfig, 'serviceId'>
  let serviceStatusStore: InMemoryStore<ServiceStatus, 'serviceId'>
  let repoStore: InMemoryStore<GitHubRepository, 'id'>
  let prereqStore: InMemoryStore<Prerequisite, 'id'>

  beforeEach(() => {
    injector = new Injector()
    useLogging(injector, VerboseConsoleLogger)

    stackDefStore = new InMemoryStore({ model: StackDefinition, primaryKey: 'name' })
    stackConfigStore = new InMemoryStore({ model: StackConfig, primaryKey: 'stackName' })
    serviceDefStore = new InMemoryStore({ model: ServiceDefinition, primaryKey: 'id' })
    serviceConfigStore = new InMemoryStore({ model: ServiceConfig, primaryKey: 'serviceId' })
    serviceStatusStore = new InMemoryStore({ model: ServiceStatus, primaryKey: 'serviceId' })
    repoStore = new InMemoryStore({ model: GitHubRepository, primaryKey: 'id' })
    prereqStore = new InMemoryStore({ model: Prerequisite, primaryKey: 'id' })

    addStore(injector, stackDefStore)
      .addStore(stackConfigStore)
      .addStore(serviceDefStore)
      .addStore(serviceConfigStore)
      .addStore(serviceStatusStore)
      .addStore(repoStore)
      .addStore(prereqStore)
      .addStore(new InMemoryStore({ model: ServiceStateHistory, primaryKey: 'id' }))

    getRepository(injector).createDataSet(StackDefinition, 'name', {})
    getRepository(injector).createDataSet(StackConfig, 'stackName', {})
    getRepository(injector).createDataSet(ServiceDefinition, 'id', {})
    getRepository(injector).createDataSet(ServiceConfig, 'serviceId', {})
    getRepository(injector).createDataSet(ServiceStatus, 'serviceId', {})
    getRepository(injector).createDataSet(GitHubRepository, 'id', {})
    getRepository(injector).createDataSet(Prerequisite, 'id', {})
    getRepository(injector).createDataSet(ServiceStateHistory, 'id', {})
  })

  afterEach(async () => {
    await injector[Symbol.asyncDispose]()
  })

  describe('ExportStackAction', () => {
    it('should export a stack with all related entities', async () => {
      const ts = now()
      await stackDefStore.add({
        name: 'my-stack',
        displayName: 'My Stack',
        description: 'Test',
        createdAt: ts,
        updatedAt: ts,
      })
      await serviceDefStore.add({
        id: 'svc-1',
        stackName: 'my-stack',
        displayName: 'Service 1',
        description: '',
        workingDirectory: 'svc1',
        runCommand: 'echo hello',
        prerequisiteIds: [],
        prerequisiteServiceIds: [],
        createdAt: ts,
        updatedAt: ts,
      })
      await repoStore.add({
        id: 'repo-1',
        stackName: 'my-stack',
        url: 'https://github.com/test/repo',
        displayName: 'Test Repo',
        description: '',
        createdAt: ts,
        updatedAt: ts,
      })
      await prereqStore.add({
        id: 'prereq-1',
        stackName: 'my-stack',
        name: 'Node.js',
        type: 'node',
        config: { minimumVersion: '18.0.0' },
        installationHelp: 'Install Node.js',
        createdAt: ts,
        updatedAt: ts,
      })

      const elevated = useSystemIdentityContext({ injector })
      const result = await ExportStackAction(
        createMockActionContext({ injector: elevated, urlParams: { id: 'my-stack' } }),
      )
      await elevated[Symbol.asyncDispose]()

      const body = result.chunk as {
        stack: StackDefinition
        services: ServiceDefinition[]
        repositories: GitHubRepository[]
        prerequisites: Prerequisite[]
      }
      expect(body.stack.name).toBe('my-stack')
      expect(body.services).toHaveLength(1)
      expect(body.services[0]?.displayName).toBe('Service 1')
      expect(body.repositories).toHaveLength(1)
      expect(body.prerequisites).toHaveLength(1)
    })

    it('should only export entities belonging to the specified stack', async () => {
      const ts = now()
      await stackDefStore.add(
        { name: 'stack-a', displayName: 'A', description: '', createdAt: ts, updatedAt: ts },
        { name: 'stack-b', displayName: 'B', description: '', createdAt: ts, updatedAt: ts },
      )
      await serviceDefStore.add(
        {
          id: 'svc-a',
          stackName: 'stack-a',
          displayName: 'Service A',
          description: '',
          workingDirectory: 'svc',
          runCommand: 'echo a',
          prerequisiteIds: [],
          prerequisiteServiceIds: [],
          createdAt: ts,
          updatedAt: ts,
        },
        {
          id: 'svc-b',
          stackName: 'stack-b',
          displayName: 'Service B',
          description: '',
          workingDirectory: 'svc',
          runCommand: 'echo b',
          prerequisiteIds: [],
          prerequisiteServiceIds: [],
          createdAt: ts,
          updatedAt: ts,
        },
      )

      const elevated = useSystemIdentityContext({ injector })
      const result = await ExportStackAction(
        createMockActionContext({ injector: elevated, urlParams: { id: 'stack-a' } }),
      )
      await elevated[Symbol.asyncDispose]()

      const body = result.chunk as { services: Array<Omit<ServiceDefinition, 'createdAt' | 'updatedAt'>> }
      expect(body.services).toHaveLength(1)
      expect(body.services[0]?.displayName).toBe('Service A')
    })

    it('should throw 404 when stack does not exist', async () => {
      const elevated = useSystemIdentityContext({ injector })
      await expect(
        ExportStackAction(createMockActionContext({ injector: elevated, urlParams: { id: 'nonexistent' } })),
      ).rejects.toThrow('Stack not found')
      await elevated[Symbol.asyncDispose]()
    })
  })

  describe('ImportStackAction', () => {
    it('should import a stack with services, repos and prerequisites', async () => {
      const importBody = {
        stack: {
          name: 'imported-stack',
          displayName: 'Imported Stack',
          description: 'Imported',
        },
        services: [
          {
            id: 'imp-svc-1',
            stackName: 'imported-stack',
            displayName: 'Imported Service',
            description: '',
            workingDirectory: 'svc',
            runCommand: 'echo hello',
            prerequisiteIds: [],
            prerequisiteServiceIds: [],
          },
        ],
        repositories: [
          {
            id: 'imp-repo-1',
            stackName: 'imported-stack',
            url: 'https://github.com/test/imported',
            displayName: 'Imported Repo',
            description: '',
          },
        ],
        prerequisites: [
          {
            id: 'imp-prereq-1',
            stackName: 'imported-stack',
            name: 'Git',
            type: 'git' as const,
            config: {},
            installationHelp: 'Install Git',
          },
        ],
        config: {
          mainDirectory: '/tmp/imported',
        },
      }

      const elevated = useSystemIdentityContext({ injector })
      const actionResult = await ImportStackAction(createMockActionContext({ injector: elevated, body: importBody }))
      const body = actionResult.chunk as { success: boolean }
      expect(body.success).toBe(true)

      const stackDefs = await stackDefStore.find({})
      expect(stackDefs).toHaveLength(1)
      expect(stackDefs[0]?.name).toBe('imported-stack')

      const stackConfigs = await stackConfigStore.find({})
      expect(stackConfigs).toHaveLength(1)
      expect(stackConfigs[0]?.mainDirectory).toBe('/tmp/imported')

      const serviceDefs = await serviceDefStore.find({})
      expect(serviceDefs).toHaveLength(1)
      expect(serviceDefs[0]?.stackName).toBe('imported-stack')

      const serviceConfigs = await serviceConfigStore.find({})
      expect(serviceConfigs).toHaveLength(1)
      expect(serviceConfigs[0]?.serviceId).toBe('imp-svc-1')

      const serviceStatuses = await serviceStatusStore.find({})
      expect(serviceStatuses).toHaveLength(1)
      expect(serviceStatuses[0]?.serviceId).toBe('imp-svc-1')

      const repos = await repoStore.find({})
      expect(repos).toHaveLength(1)

      const prereqs = await prereqStore.find({})
      expect(prereqs).toHaveLength(1)
      await elevated[Symbol.asyncDispose]()
    })

    it('should reset service statuses on import', async () => {
      const importBody = {
        stack: {
          name: 'reset-test',
          displayName: 'Reset Test',
          description: '',
        },
        services: [
          {
            id: 'reset-svc',
            stackName: 'reset-test',
            displayName: 'Reset Service',
            description: '',
            workingDirectory: 'svc',
            runCommand: 'echo hi',
            prerequisiteIds: [],
            prerequisiteServiceIds: [],
          },
        ],
        repositories: [],
        prerequisites: [],
        config: {
          mainDirectory: '/tmp/reset',
        },
      }

      const elevated = useSystemIdentityContext({ injector })
      await ImportStackAction(createMockActionContext({ injector: elevated, body: importBody }))

      const [status] = await serviceStatusStore.find({ filter: { serviceId: { $eq: 'reset-svc' } }, top: 1 })
      expect(status?.installStatus).toBe('not-installed')
      expect(status?.buildStatus).toBe('not-built')
      expect(status?.runStatus).toBe('stopped')
      await elevated[Symbol.asyncDispose]()
    })
  })
})
