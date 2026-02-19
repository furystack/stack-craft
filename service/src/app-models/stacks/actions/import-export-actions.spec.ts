import { addStore, InMemoryStore, useSystemIdentityContext } from '@furystack/core'
import { Injector } from '@furystack/inject'
import { useLogging, VerboseConsoleLogger } from '@furystack/logging'
import { getRepository } from '@furystack/repository'
import { Dependency, GitHubRepository, Service, Stack } from 'common'
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
  let stackStore: InMemoryStore<Stack, 'name'>
  let serviceStore: InMemoryStore<Service, 'id'>
  let repoStore: InMemoryStore<GitHubRepository, 'id'>
  let depStore: InMemoryStore<Dependency, 'id'>

  beforeEach(() => {
    injector = new Injector()
    useLogging(injector, VerboseConsoleLogger)

    stackStore = new InMemoryStore({ model: Stack, primaryKey: 'name' })
    serviceStore = new InMemoryStore({ model: Service, primaryKey: 'id' })
    repoStore = new InMemoryStore({ model: GitHubRepository, primaryKey: 'id' })
    depStore = new InMemoryStore({ model: Dependency, primaryKey: 'id' })

    addStore(injector, stackStore).addStore(serviceStore).addStore(repoStore).addStore(depStore)

    getRepository(injector).createDataSet(Stack, 'name', {})
    getRepository(injector).createDataSet(Service, 'id', {})
    getRepository(injector).createDataSet(GitHubRepository, 'id', {})
    getRepository(injector).createDataSet(Dependency, 'id', {})
  })

  afterEach(async () => {
    await injector[Symbol.asyncDispose]()
  })

  describe('ExportStackAction', () => {
    it('should export a stack with all related entities', async () => {
      const ts = now()
      await stackStore.add({
        name: 'my-stack',
        displayName: 'My Stack',
        description: 'Test',
        mainDirectory: '/tmp/stack',
        createdAt: ts,
        updatedAt: ts,
      })
      await serviceStore.add({
        id: 'svc-1',
        stackName: 'my-stack',
        displayName: 'Service 1',
        description: '',
        workingDirectory: 'svc1',
        runCommand: 'echo hello',
        installStatus: 'not-installed',
        buildStatus: 'not-built',
        runStatus: 'stopped',
        autoFetchEnabled: false,
        autoFetchIntervalMinutes: 60,
        autoRestartOnFetch: false,
        dependencyIds: [],
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
      await depStore.add({
        id: 'dep-1',
        stackName: 'my-stack',
        name: 'Node.js',
        checkCommand: 'node --version',
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
        stack: Stack
        services: Service[]
        repositories: GitHubRepository[]
        dependencies: Dependency[]
      }
      expect(body.stack.name).toBe('my-stack')
      expect(body.services).toHaveLength(1)
      expect(body.services[0]?.displayName).toBe('Service 1')
      expect(body.repositories).toHaveLength(1)
      expect(body.dependencies).toHaveLength(1)
    })

    it('should only export entities belonging to the specified stack', async () => {
      const ts = now()
      await stackStore.add(
        { name: 'stack-a', displayName: 'A', description: '', mainDirectory: '/a', createdAt: ts, updatedAt: ts },
        { name: 'stack-b', displayName: 'B', description: '', mainDirectory: '/b', createdAt: ts, updatedAt: ts },
      )
      await serviceStore.add(
        {
          id: 'svc-a',
          stackName: 'stack-a',
          displayName: 'Service A',
          description: '',
          workingDirectory: 'svc',
          runCommand: 'echo a',
          installStatus: 'not-installed',
          buildStatus: 'not-built',
          runStatus: 'stopped',
          autoFetchEnabled: false,
          autoFetchIntervalMinutes: 60,
          autoRestartOnFetch: false,
          dependencyIds: [],
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
          installStatus: 'not-installed',
          buildStatus: 'not-built',
          runStatus: 'stopped',
          autoFetchEnabled: false,
          autoFetchIntervalMinutes: 60,
          autoRestartOnFetch: false,
          dependencyIds: [],
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

      const body = result.chunk as { services: Service[] }
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
    it('should import a stack with services, repos and dependencies', async () => {
      const ts = now()
      const importBody = {
        stack: {
          name: 'imported-stack',
          displayName: 'Imported Stack',
          description: 'Imported',
          mainDirectory: '/tmp/imported',
          createdAt: ts,
          updatedAt: ts,
        } satisfies Stack,
        services: [
          {
            id: 'imp-svc-1',
            stackName: 'imported-stack',
            displayName: 'Imported Service',
            description: '',
            workingDirectory: 'svc',
            runCommand: 'echo hello',
            autoFetchEnabled: false,
            autoFetchIntervalMinutes: 60,
            autoRestartOnFetch: false,
            dependencyIds: [],
            prerequisiteServiceIds: [],
            installStatus: 'installed' as const,
            buildStatus: 'built' as const,
            runStatus: 'running' as const,
            createdAt: ts,
            updatedAt: ts,
          } satisfies Service,
        ],
        repositories: [
          {
            id: 'imp-repo-1',
            stackName: 'imported-stack',
            url: 'https://github.com/test/imported',
            displayName: 'Imported Repo',
            description: '',
            createdAt: ts,
            updatedAt: ts,
          } satisfies GitHubRepository,
        ],
        dependencies: [
          {
            id: 'imp-dep-1',
            stackName: 'imported-stack',
            name: 'Git',
            checkCommand: 'git --version',
            installationHelp: 'Install Git',
            createdAt: ts,
            updatedAt: ts,
          } satisfies Dependency,
        ],
      }

      const elevated = useSystemIdentityContext({ injector })
      const actionResult = await ImportStackAction(createMockActionContext({ injector: elevated, body: importBody }))
      const body = actionResult.chunk as { success: boolean }
      expect(body.success).toBe(true)

      const stacks = await stackStore.find({})
      expect(stacks).toHaveLength(1)
      expect(stacks[0]?.name).toBe('imported-stack')

      const services = await serviceStore.find({})
      expect(services).toHaveLength(1)
      expect(services[0]?.stackName).toBe('imported-stack')

      const repos = await repoStore.find({})
      expect(repos).toHaveLength(1)

      const deps = await depStore.find({})
      expect(deps).toHaveLength(1)
      await elevated[Symbol.asyncDispose]()
    })

    it('should reset service statuses on import', async () => {
      const ts = now()
      const importBody = {
        stack: {
          name: 'reset-test',
          displayName: 'Reset Test',
          description: '',
          mainDirectory: '/tmp/reset',
          createdAt: ts,
          updatedAt: ts,
        } satisfies Stack,
        services: [
          {
            id: 'reset-svc',
            stackName: 'reset-test',
            displayName: 'Reset Service',
            description: '',
            workingDirectory: 'svc',
            runCommand: 'echo hi',
            autoFetchEnabled: false,
            autoFetchIntervalMinutes: 60,
            autoRestartOnFetch: false,
            dependencyIds: [],
            prerequisiteServiceIds: [],
            installStatus: 'installed' as const,
            buildStatus: 'built' as const,
            runStatus: 'running' as const,
            createdAt: ts,
            updatedAt: ts,
          } satisfies Service,
        ],
        repositories: [] as GitHubRepository[],
        dependencies: [] as Dependency[],
      }

      const elevated = useSystemIdentityContext({ injector })
      await ImportStackAction(createMockActionContext({ injector: elevated, body: importBody }))

      const [svc] = await serviceStore.find({ filter: { id: { $eq: 'reset-svc' } }, top: 1 })
      expect(svc?.installStatus).toBe('not-installed')
      expect(svc?.buildStatus).toBe('not-built')
      expect(svc?.runStatus).toBe('stopped')
      await elevated[Symbol.asyncDispose]()
    })
  })
})
