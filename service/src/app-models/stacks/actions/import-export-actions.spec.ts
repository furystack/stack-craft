import { addStore, getStoreManager, InMemoryStore } from '@furystack/core'
import { Injector } from '@furystack/inject'
import { useLogging, VerboseConsoleLogger } from '@furystack/logging'
import { Dependency, GitHubRepository, Service, Stack } from 'common'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

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
  })

  afterEach(async () => {
    await injector[Symbol.asyncDispose]()
  })

  describe('Export', () => {
    it('should export a stack with all related entities', async () => {
      const now = new Date().toISOString()
      await stackStore.add({
        name: 'my-stack',
        displayName: 'My Stack',
        description: 'Test',
        mainDirectory: '/tmp/stack',
        createdAt: now,
        updatedAt: now,
      })

      await serviceStore.add({
        id: 'svc-1',
        stackName: 'my-stack',
        displayName: 'Service 1',
        description: '',
        workingDirectory: '/tmp/svc1',
        runCommand: 'echo hello',
        installStatus: 'not-installed',
        buildStatus: 'not-built',
        runStatus: 'stopped',
        autoFetchEnabled: false,
        autoFetchIntervalMinutes: 60,
        autoRestartOnFetch: false,
        dependencyIds: [],
        prerequisiteServiceIds: [],
        createdAt: now,
        updatedAt: now,
      })

      await repoStore.add({
        id: 'repo-1',
        stackName: 'my-stack',
        url: 'https://github.com/test/repo',
        displayName: 'Test Repo',
        description: '',
        createdAt: now,
        updatedAt: now,
      })

      await depStore.add({
        id: 'dep-1',
        stackName: 'my-stack',
        name: 'Node.js',
        checkCommand: 'node --version',
        installationHelp: 'Install Node.js',
        createdAt: now,
        updatedAt: now,
      })

      const sm = getStoreManager(injector)
      const stack = (await sm.getStoreFor(Stack, 'name').find({ filter: { name: { $eq: 'my-stack' } }, top: 1 }))[0]
      const services = await sm.getStoreFor(Service, 'id').find({ filter: { stackName: { $eq: 'my-stack' } } })
      const repositories = await sm
        .getStoreFor(GitHubRepository, 'id')
        .find({ filter: { stackName: { $eq: 'my-stack' } } })
      const dependencies = await sm.getStoreFor(Dependency, 'id').find({ filter: { stackName: { $eq: 'my-stack' } } })

      expect(stack).toBeDefined()
      expect(stack?.name).toBe('my-stack')
      expect(services).toHaveLength(1)
      expect(services[0]?.displayName).toBe('Service 1')
      expect(repositories).toHaveLength(1)
      expect(dependencies).toHaveLength(1)
    })

    it('should only export entities belonging to the specified stack', async () => {
      const now = new Date().toISOString()
      await stackStore.add(
        { name: 'stack-a', displayName: 'A', description: '', mainDirectory: '/a', createdAt: now, updatedAt: now },
        { name: 'stack-b', displayName: 'B', description: '', mainDirectory: '/b', createdAt: now, updatedAt: now },
      )

      await serviceStore.add(
        {
          id: 'svc-a',
          stackName: 'stack-a',
          displayName: 'Service A',
          description: '',
          workingDirectory: '/a/svc',
          runCommand: 'echo a',
          installStatus: 'not-installed',
          buildStatus: 'not-built',
          runStatus: 'stopped',
          autoFetchEnabled: false,
          autoFetchIntervalMinutes: 60,
          autoRestartOnFetch: false,
          dependencyIds: [],
          prerequisiteServiceIds: [],
          createdAt: now,
          updatedAt: now,
        },
        {
          id: 'svc-b',
          stackName: 'stack-b',
          displayName: 'Service B',
          description: '',
          workingDirectory: '/b/svc',
          runCommand: 'echo b',
          installStatus: 'not-installed',
          buildStatus: 'not-built',
          runStatus: 'stopped',
          autoFetchEnabled: false,
          autoFetchIntervalMinutes: 60,
          autoRestartOnFetch: false,
          dependencyIds: [],
          prerequisiteServiceIds: [],
          createdAt: now,
          updatedAt: now,
        },
      )

      const sm = getStoreManager(injector)
      const servicesA = await sm.getStoreFor(Service, 'id').find({ filter: { stackName: { $eq: 'stack-a' } } })
      const servicesB = await sm.getStoreFor(Service, 'id').find({ filter: { stackName: { $eq: 'stack-b' } } })

      expect(servicesA).toHaveLength(1)
      expect(servicesA[0]?.displayName).toBe('Service A')
      expect(servicesB).toHaveLength(1)
      expect(servicesB[0]?.displayName).toBe('Service B')
    })
  })

  describe('Import', () => {
    it('should import a stack with services, repos and dependencies', async () => {
      const now = new Date().toISOString()
      const importData = {
        stack: {
          name: 'imported-stack',
          displayName: 'Imported Stack',
          description: 'Imported',
          mainDirectory: '/tmp/imported',
          createdAt: now,
          updatedAt: now,
        },
        services: [
          {
            id: 'imp-svc-1',
            stackName: 'imported-stack',
            displayName: 'Imported Service',
            description: '',
            workingDirectory: '/tmp/imported/svc',
            runCommand: 'echo hello',
            autoFetchEnabled: false,
            autoFetchIntervalMinutes: 60,
            autoRestartOnFetch: false,
            dependencyIds: [],
            prerequisiteServiceIds: [],
            installStatus: 'installed' as const,
            buildStatus: 'built' as const,
            runStatus: 'running' as const,
            createdAt: now,
            updatedAt: now,
          },
        ],
        repositories: [
          {
            id: 'imp-repo-1',
            stackName: 'imported-stack',
            url: 'https://github.com/test/imported',
            displayName: 'Imported Repo',
            description: '',
            createdAt: now,
            updatedAt: now,
          },
        ],
        dependencies: [
          {
            id: 'imp-dep-1',
            stackName: 'imported-stack',
            name: 'Git',
            checkCommand: 'git --version',
            installationHelp: 'Install Git',
            createdAt: now,
            updatedAt: now,
          },
        ],
      }

      const sm = getStoreManager(injector)

      await sm.getStoreFor(Stack, 'name').add({ ...importData.stack, createdAt: now, updatedAt: now })

      const importedServices = importData.services.map((svc) => ({
        ...svc,
        stackName: importData.stack.name,
        installStatus: 'not-installed' as const,
        buildStatus: 'not-built' as const,
        runStatus: 'stopped' as const,
        createdAt: now,
        updatedAt: now,
      }))
      await sm.getStoreFor(Service, 'id').add(...importedServices)

      await sm
        .getStoreFor(GitHubRepository, 'id')
        .add(...importData.repositories.map((r) => ({ ...r, createdAt: now, updatedAt: now })))
      await sm
        .getStoreFor(Dependency, 'id')
        .add(...importData.dependencies.map((d) => ({ ...d, createdAt: now, updatedAt: now })))

      const stacks = await sm.getStoreFor(Stack, 'name').find({})
      expect(stacks).toHaveLength(1)
      expect(stacks[0]?.name).toBe('imported-stack')

      const services = await sm.getStoreFor(Service, 'id').find({ filter: { stackName: { $eq: 'imported-stack' } } })
      expect(services).toHaveLength(1)
      expect(services[0]?.installStatus).toBe('not-installed')
      expect(services[0]?.buildStatus).toBe('not-built')
      expect(services[0]?.runStatus).toBe('stopped')

      const repos = await sm.getStoreFor(GitHubRepository, 'id').find({})
      expect(repos).toHaveLength(1)

      const deps = await sm.getStoreFor(Dependency, 'id').find({})
      expect(deps).toHaveLength(1)
    })

    it('should reset service statuses on import', async () => {
      const now = new Date().toISOString()
      const sm = getStoreManager(injector)

      await sm.getStoreFor(Stack, 'name').add({
        name: 'reset-test',
        displayName: 'Reset Test',
        description: '',
        mainDirectory: '/tmp/reset',
        createdAt: now,
        updatedAt: now,
      })

      await sm.getStoreFor(Service, 'id').add({
        id: 'reset-svc',
        stackName: 'reset-test',
        displayName: 'Reset Service',
        description: '',
        workingDirectory: '/tmp/reset/svc',
        runCommand: 'echo hi',
        installStatus: 'not-installed',
        buildStatus: 'not-built',
        runStatus: 'stopped',
        autoFetchEnabled: false,
        autoFetchIntervalMinutes: 60,
        autoRestartOnFetch: false,
        dependencyIds: [],
        prerequisiteServiceIds: [],
        createdAt: now,
        updatedAt: now,
      })

      const [svc] = await sm.getStoreFor(Service, 'id').find({ filter: { id: { $eq: 'reset-svc' } }, top: 1 })
      expect(svc?.installStatus).toBe('not-installed')
      expect(svc?.buildStatus).toBe('not-built')
      expect(svc?.runStatus).toBe('stopped')
    })
  })
})
