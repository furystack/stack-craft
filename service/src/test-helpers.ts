import { IdentityContext, InMemoryStore, type StoreToken, useSystemIdentityContext } from '@furystack/core'
import { createInjector, type Injector } from '@furystack/inject'
import { useLogging, VerboseConsoleLogger } from '@furystack/logging'
import { usePasswordPolicy } from '@furystack/security'
import { ServiceStateHistory } from 'common'

import {
  AppPasswordCredentialStore,
  AppPasswordResetTokenStore,
  AppSessionStore,
  AppUserStore,
  ApiTokenStore,
  bindAuthenticationStores,
  GitHubRepositoryStore,
  PrerequisiteStore,
  ServiceConfigStore,
  ServiceDefinitionStore,
  ServiceDependencyLinkStore,
  ServicePrerequisiteLinkStore,
  ServiceStateHistoryStore,
  ServiceStatusStore,
  StackConfigStore,
  StackDefinitionStore,
} from './app-models/data-store/tokens.js'

const bindInMemory = <T extends object, TPK extends keyof T>(injector: Injector, token: StoreToken<T, TPK>): void => {
  injector.bind(token, () => new InMemoryStore({ model: token.model, primaryKey: token.primaryKey }))
}

export const createTestInjector = () => {
  const injector = createInjector()
  useLogging(injector, VerboseConsoleLogger)

  bindInMemory(injector, AppUserStore)
  bindInMemory(injector, AppPasswordCredentialStore)
  bindInMemory(injector, AppPasswordResetTokenStore)
  bindInMemory(injector, AppSessionStore)
  bindInMemory(injector, ApiTokenStore)
  bindInMemory(injector, StackDefinitionStore)
  bindInMemory(injector, StackConfigStore)
  bindInMemory(injector, GitHubRepositoryStore)
  bindInMemory(injector, PrerequisiteStore)
  bindInMemory(injector, ServiceDefinitionStore)
  bindInMemory(injector, ServiceConfigStore)
  bindInMemory(injector, ServiceStatusStore)
  bindInMemory(injector, ServicePrerequisiteLinkStore)
  bindInMemory(injector, ServiceDependencyLinkStore)

  let historyIdCounter = 0
  injector.bind(ServiceStateHistoryStore, () => {
    const store = new InMemoryStore<ServiceStateHistory, 'id'>({ model: ServiceStateHistory, primaryKey: 'id' })
    const originalAdd = store.add.bind(store)
    store.add = async (entry) => originalAdd({ ...entry, id: entry.id ?? `h-${++historyIdCounter}` })
    return store
  })

  bindAuthenticationStores(injector)
  usePasswordPolicy(injector)

  // Bind a permissive IdentityContext on the test injector so calls that pass
  // the un-elevated injector (e.g. RequestActions in tests) bypass DataSet
  // authorization. Production HTTP requests resolve their own scoped
  // IdentityContext from the request.
  injector.bind(IdentityContext, () => ({
    isAuthenticated: () => Promise.resolve(true),
    isAuthorized: () => Promise.resolve(true),
    getCurrentUser: () => Promise.resolve({ username: 'test', roles: ['admin'] } as never),
  }))

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
