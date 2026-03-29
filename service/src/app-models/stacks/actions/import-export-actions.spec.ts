import { addStore, InMemoryStore, useSystemIdentityContext } from '@furystack/core'
import { Injector } from '@furystack/inject'
import { useLogging, VerboseConsoleLogger } from '@furystack/logging'
import { getRepository } from '@furystack/repository'
import { usingAsync } from '@furystack/utils'
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
import { randomBytes } from 'crypto'
import { describe, expect, it } from 'vitest'

import { ExportStackAction } from './export-stack-action.js'
import { ImportStackAction } from './import-stack-action.js'

class AutoIncrementStore<T extends { id: number }> extends InMemoryStore<T, 'id'> {
  private nextId = 1

  public async add(...items: T[]) {
    const withIds = items.map((item) => ({
      ...item,
      id: item.id || this.nextId++,
    }))
    return super.add(...withIds)
  }
}

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

const createSetup = () => {
  process.env.STACK_CRAFT_ENCRYPTION_KEY = randomBytes(32).toString('base64')
  const injector = new Injector()
  useLogging(injector, VerboseConsoleLogger)

  const stackDefStore = new InMemoryStore({ model: StackDefinition, primaryKey: 'name' })
  const stackConfigStore = new InMemoryStore({ model: StackConfig, primaryKey: 'stackName' })
  const serviceDefStore = new InMemoryStore({ model: ServiceDefinition, primaryKey: 'id' })
  const serviceConfigStore = new InMemoryStore({ model: ServiceConfig, primaryKey: 'serviceId' })
  const serviceStatusStore = new InMemoryStore({ model: ServiceStatus, primaryKey: 'serviceId' })
  const repoStore = new InMemoryStore({ model: GitHubRepository, primaryKey: 'id' })
  const prereqStore = new InMemoryStore({ model: Prerequisite, primaryKey: 'id' })

  addStore(injector, stackDefStore)
    .addStore(stackConfigStore)
    .addStore(serviceDefStore)
    .addStore(serviceConfigStore)
    .addStore(serviceStatusStore)
    .addStore(repoStore)
    .addStore(prereqStore)
    .addStore(new AutoIncrementStore({ model: ServiceStateHistory, primaryKey: 'id' }))

  getRepository(injector).createDataSet(StackDefinition, 'name', {})
  getRepository(injector).createDataSet(StackConfig, 'stackName', {})
  getRepository(injector).createDataSet(ServiceDefinition, 'id', {})
  getRepository(injector).createDataSet(ServiceConfig, 'serviceId', {})
  getRepository(injector).createDataSet(ServiceStatus, 'serviceId', {})
  getRepository(injector).createDataSet(GitHubRepository, 'id', {})
  getRepository(injector).createDataSet(Prerequisite, 'id', {})
  getRepository(injector).createDataSet(ServiceStateHistory, 'id', {})

  return {
    injector,
    stackDefStore,
    stackConfigStore,
    serviceDefStore,
    serviceConfigStore,
    serviceStatusStore,
    repoStore,
    prereqStore,
  }
}

describe('Import/Export Stack Actions', () => {
  describe('ExportStackAction', () => {
    it('should export a stack with all related entities', async () => {
      const { injector, stackDefStore, serviceDefStore, repoStore, prereqStore } = createSetup()
      await usingAsync(injector, async () => {
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
          files: [],
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
    })

    it('should only export entities belonging to the specified stack', async () => {
      const { injector, stackDefStore, serviceDefStore } = createSetup()
      await usingAsync(injector, async () => {
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
            files: [],
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
            files: [],
            createdAt: ts,
            updatedAt: ts,
          },
        )

        const elevated = useSystemIdentityContext({ injector })
        const result = await ExportStackAction(
          createMockActionContext({ injector: elevated, urlParams: { id: 'stack-a' } }),
        )

        const body = result.chunk as { services: Array<Omit<ServiceDefinition, 'createdAt' | 'updatedAt'>> }
        expect(body.services).toHaveLength(1)
        expect(body.services[0]?.displayName).toBe('Service A')
      })
    })

    it('should throw 404 when stack does not exist', async () => {
      const { injector } = createSetup()
      await usingAsync(injector, async () => {
        const elevated = useSystemIdentityContext({ injector })
        await expect(
          ExportStackAction(createMockActionContext({ injector: elevated, urlParams: { id: 'nonexistent' } })),
        ).rejects.toThrow('Stack not found')
      })
    })
  })

  describe('ImportStackAction', () => {
    it('should import a stack with services, repos and prerequisites', async () => {
      const {
        injector,
        stackDefStore,
        stackConfigStore,
        serviceDefStore,
        serviceConfigStore,
        serviceStatusStore,
        repoStore,
        prereqStore,
      } = createSetup()
      await usingAsync(injector, async () => {
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
              files: [],
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
      })
    })

    it('should reset service statuses on import', async () => {
      const { injector, serviceStatusStore } = createSetup()
      await usingAsync(injector, async () => {
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
              files: [],
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
      })
    })

    it('should apply per-service config when provided', async () => {
      const { injector, serviceConfigStore } = createSetup()
      await usingAsync(injector, async () => {
        const importBody = {
          stack: {
            name: 'config-test',
            displayName: 'Config Test',
            description: '',
          },
          services: [
            {
              id: 'cfg-svc-1',
              stackName: 'config-test',
              displayName: 'Configured Service',
              description: '',
              workingDirectory: 'svc',
              runCommand: 'echo hi',
              prerequisiteIds: [],
              prerequisiteServiceIds: [],
              files: [],
            },
            {
              id: 'cfg-svc-2',
              stackName: 'config-test',
              displayName: 'Default Service',
              description: '',
              workingDirectory: 'svc2',
              runCommand: 'echo hello',
              prerequisiteIds: [],
              prerequisiteServiceIds: [],
              files: [],
            },
          ],
          repositories: [],
          prerequisites: [],
          config: {
            mainDirectory: '/tmp/config-test',
            services: {
              'cfg-svc-1': {
                autoFetchEnabled: true,
                autoFetchIntervalMinutes: 15,
                autoRestartOnFetch: true,
              },
            },
          },
        }

        const elevated = useSystemIdentityContext({ injector })
        await ImportStackAction(createMockActionContext({ injector: elevated, body: importBody }))

        const [configuredSvc] = await serviceConfigStore.find({
          filter: { serviceId: { $eq: 'cfg-svc-1' } },
          top: 1,
        })
        expect(configuredSvc?.autoFetchEnabled).toBe(true)
        expect(configuredSvc?.autoFetchIntervalMinutes).toBe(15)
        expect(configuredSvc?.autoRestartOnFetch).toBe(true)

        const [defaultSvc] = await serviceConfigStore.find({
          filter: { serviceId: { $eq: 'cfg-svc-2' } },
          top: 1,
        })
        expect(defaultSvc?.autoFetchEnabled).toBe(false)
        expect(defaultSvc?.autoFetchIntervalMinutes).toBe(60)
        expect(defaultSvc?.autoRestartOnFetch).toBe(false)
      })
    })

    it('should import multiple services without id conflicts in history', async () => {
      const { injector, serviceDefStore, serviceStatusStore } = createSetup()
      await usingAsync(injector, async () => {
        const importBody = {
          stack: {
            name: 'multi-svc-test',
            displayName: 'Multi Service Test',
            description: '',
          },
          services: [
            {
              id: 'multi-svc-1',
              stackName: 'multi-svc-test',
              displayName: 'Service One',
              description: '',
              workingDirectory: 'svc1',
              runCommand: 'echo 1',
              prerequisiteIds: [],
              prerequisiteServiceIds: [],
              files: [],
            },
            {
              id: 'multi-svc-2',
              stackName: 'multi-svc-test',
              displayName: 'Service Two',
              description: '',
              workingDirectory: 'svc2',
              runCommand: 'echo 2',
              prerequisiteIds: [],
              prerequisiteServiceIds: [],
              files: [],
            },
          ],
          repositories: [],
          prerequisites: [],
          config: {
            mainDirectory: '/tmp/multi',
          },
        }

        const elevated = useSystemIdentityContext({ injector })
        const actionResult = await ImportStackAction(createMockActionContext({ injector: elevated, body: importBody }))
        const body = actionResult.chunk as { success: boolean }
        expect(body.success).toBe(true)

        const serviceDefs = await serviceDefStore.find({})
        expect(serviceDefs).toHaveLength(2)

        const serviceStatuses = await serviceStatusStore.find({})
        expect(serviceStatuses).toHaveLength(2)
      })
    })

    it('should persist environment variable config during import', async () => {
      const { injector, stackConfigStore, serviceConfigStore } = createSetup()
      await usingAsync(injector, async () => {
        const importBody = {
          stack: {
            name: 'env-vars-stack',
            displayName: 'Env Vars Stack',
            description: '',
          },
          services: [
            {
              id: 'env-svc-1',
              stackName: 'env-vars-stack',
              displayName: 'Env Service',
              description: '',
              workingDirectory: 'svc',
              runCommand: 'echo hello',
              prerequisiteIds: [],
              prerequisiteServiceIds: [],
              files: [],
            },
          ],
          repositories: [],
          prerequisites: [],
          config: {
            mainDirectory: '/tmp/env-test',
            environmentVariables: {
              DATABASE_URL: { source: 'custom' as const, customValue: 'postgres://localhost/db' },
              API_KEY: { source: 'inherit' as const },
            },
            services: {
              'env-svc-1': {
                environmentVariableOverrides: {
                  DATABASE_URL: { source: 'custom' as const, customValue: 'postgres://localhost/svc-db' },
                },
              },
            },
          },
        }

        const elevated = useSystemIdentityContext({ injector })
        await ImportStackAction(createMockActionContext({ injector: elevated, body: importBody }))

        const stackConfigs = await stackConfigStore.find({})
        const stackConfig = stackConfigs.find((c) => c.stackName === 'env-vars-stack')
        expect(stackConfig?.environmentVariables).toEqual({
          DATABASE_URL: { source: 'custom', customValue: 'postgres://localhost/db' },
          API_KEY: { source: 'inherit' },
        })

        const [svcConfig] = await serviceConfigStore.find({
          filter: { serviceId: { $eq: 'env-svc-1' } },
          top: 1,
        })
        expect(svcConfig?.environmentVariableOverrides).toEqual({
          DATABASE_URL: { source: 'custom', customValue: 'postgres://localhost/svc-db' },
        })
      })
    })
  })
})
