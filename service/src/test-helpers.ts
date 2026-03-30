import { addStore, InMemoryStore, useSystemIdentityContext } from '@furystack/core'
import type { Injector } from '@furystack/inject'
import { Injector as InjectorImpl } from '@furystack/inject'
import { useLogging, VerboseConsoleLogger } from '@furystack/logging'
import { getRepository } from '@furystack/repository'
import { PasswordCredential, PasswordResetToken, usePasswordPolicy } from '@furystack/security'
import {
  GitHubRepository,
  Prerequisite,
  PrerequisiteCheckResult,
  ServiceConfig,
  ServiceDefinition,
  ServiceDependencyLink,
  ServiceGitStatus,
  ServiceLogEntry,
  ServicePrerequisiteLink,
  ServiceStateHistory,
  ServiceStatus,
  StackConfig,
  StackDefinition,
  User,
} from 'common'

export const createTestInjector = () => {
  const injector = new InjectorImpl()
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
  addStore(injector, new InMemoryStore({ model: ServicePrerequisiteLink, primaryKey: 'id' }))
  addStore(injector, new InMemoryStore({ model: ServiceDependencyLink, primaryKey: 'id' }))
  addStore(injector, new InMemoryStore({ model: User, primaryKey: 'username' }))
  addStore(injector, new InMemoryStore({ model: PasswordCredential, primaryKey: 'userName' }))
  addStore(injector, new InMemoryStore({ model: PasswordResetToken, primaryKey: 'token' }))

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
  getRepository(injector).createDataSet(ServicePrerequisiteLink, 'id', {})
  getRepository(injector).createDataSet(ServiceDependencyLink, 'id', {})
  getRepository(injector).createDataSet(User, 'username', {})
  getRepository(injector).createDataSet(PasswordCredential, 'userName', {})
  getRepository(injector).createDataSet(PasswordResetToken, 'token')

  usePasswordPolicy(injector)

  const elevated = useSystemIdentityContext({ injector })

  return { injector, elevated }
}

/**
 * Runs a test callback with a fully configured test injector and elevated context.
 * Both are automatically disposed after the callback completes (or throws).
 */
export const withTestInjector = async (fn: (ctx: { injector: Injector; elevated: Injector }) => Promise<void>) => {
  const { injector, elevated } = createTestInjector()
  try {
    await fn({ injector, elevated })
  } finally {
    await elevated[Symbol.asyncDispose]()
    await injector[Symbol.asyncDispose]()
  }
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
