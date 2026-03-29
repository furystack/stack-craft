import { addStore, InMemoryStore, useSystemIdentityContext } from '@furystack/core'
import { Injector } from '@furystack/inject'
import { useLogging, VerboseConsoleLogger } from '@furystack/logging'
import { getRepository } from '@furystack/repository'
import {
  GitHubRepository,
  Prerequisite,
  PrerequisiteCheckResult,
  ServiceConfig,
  ServiceDefinition,
  ServiceGitStatus,
  ServiceLogEntry,
  ServiceStateHistory,
  ServiceStatus,
  StackConfig,
  StackDefinition,
} from 'common'

export const createTestInjector = () => {
  const injector = new Injector()
  useLogging(injector, VerboseConsoleLogger)

  addStore(injector, new InMemoryStore({ model: StackDefinition, primaryKey: 'name' }))
  addStore(injector, new InMemoryStore({ model: StackConfig, primaryKey: 'stackName' }))
  addStore(injector, new InMemoryStore({ model: GitHubRepository, primaryKey: 'id' }))
  addStore(injector, new InMemoryStore({ model: Prerequisite, primaryKey: 'id' }))
  addStore(injector, new InMemoryStore({ model: PrerequisiteCheckResult, primaryKey: 'prerequisiteId' }))
  addStore(injector, new InMemoryStore({ model: ServiceDefinition, primaryKey: 'id' }))
  addStore(injector, new InMemoryStore({ model: ServiceConfig, primaryKey: 'serviceId' }))
  addStore(injector, new InMemoryStore({ model: ServiceStatus, primaryKey: 'serviceId' }))
  addStore(injector, new InMemoryStore({ model: ServiceGitStatus, primaryKey: 'serviceId' }))
  addStore(injector, new InMemoryStore({ model: ServiceLogEntry, primaryKey: 'id' }))
  addStore(injector, new InMemoryStore({ model: ServiceStateHistory, primaryKey: 'id' }))

  getRepository(injector).createDataSet(StackDefinition, 'name', {})
  getRepository(injector).createDataSet(StackConfig, 'stackName', {})
  getRepository(injector).createDataSet(GitHubRepository, 'id', {})
  getRepository(injector).createDataSet(Prerequisite, 'id', {})
  getRepository(injector).createDataSet(PrerequisiteCheckResult, 'prerequisiteId', {})
  getRepository(injector).createDataSet(ServiceDefinition, 'id', {})
  getRepository(injector).createDataSet(ServiceConfig, 'serviceId', {})
  getRepository(injector).createDataSet(ServiceStatus, 'serviceId', {})
  getRepository(injector).createDataSet(ServiceGitStatus, 'serviceId', {})
  getRepository(injector).createDataSet(ServiceLogEntry, 'id', {})
  getRepository(injector).createDataSet(ServiceStateHistory, 'id', {})

  const elevated = useSystemIdentityContext({ injector })

  return { injector, elevated }
}

export const createMockActionContext = <TBody = unknown, TUrl = Record<string, string>>(options: {
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
