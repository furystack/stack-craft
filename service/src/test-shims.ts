/**
 * Test-only shims that restore the deprecated decorator-era APIs as thin
 * wrappers over the new functional-DI surface.
 *
 * Augments {@link Injector} with `setExplicitInstance` (delegates to `bind`)
 * and a `cachedSingletons` map view, and exposes the legacy `addStore` /
 * `getStoreManager` helpers that operate against the registered store
 * tokens declared in `app-models/data-store/tokens.ts`.
 *
 * This module exists purely to keep the existing spec files compiling; new
 * tests should call `injector.bind(...)` and use store tokens directly.
 */
import type { Constructable, PhysicalStore, User } from '@furystack/core'
import { IdentityContext, InMemoryStore } from '@furystack/core'
import { Injector } from '@furystack/inject'
import type { DataSetToken, DataSet, AuthorizationResult } from '@furystack/repository'
import { SessionStore as RestServiceSessionStore, UserStore as RestServiceUserStore } from '@furystack/rest-service'
import {
  PasswordCredentialStore as SecurityPasswordCredentialStore,
  PasswordResetTokenStore as SecurityPasswordResetTokenStore,
} from '@furystack/security'

import * as DataStoreTokens from './app-models/data-store/tokens.js'
import * as LogStoreTokens from './app-models/logs/setup-log-store.js'

declare module '@furystack/inject' {
  interface Injector {
    /** @deprecated Use `injector.bind(token, () => instance)` instead. */
    setExplicitInstance<T>(instance: T, token: unknown): void
    /** @deprecated Use `injector.isResolved(token)` instead. */
    cachedSingletons: {
      has(token: unknown): boolean
      get(token: unknown): unknown
      set(token: unknown, value: unknown): void
    }
  }
}

const proto = Injector.prototype as unknown as {
  setExplicitInstance?: (this: Injector, instance: unknown, token: unknown) => void
  cachedSingletons?: { has(token: unknown): boolean; get(token: unknown): unknown }
}

if (!proto.setExplicitInstance) {
  proto.setExplicitInstance = function (this: Injector, instance: unknown, token: unknown): void {
    this.bind(token as Parameters<Injector['bind']>[0], () => instance as never)
  }
}

if (!proto.cachedSingletons) {
  Object.defineProperty(Injector.prototype, 'cachedSingletons', {
    get(this: Injector) {
      // eslint-disable-next-line @typescript-eslint/no-this-alias
      const owner = this
      return {
        has: (token: unknown) => owner.isResolved(token as Parameters<Injector['isResolved']>[0]),
        get: (token: unknown) =>
          owner.isResolved(token as Parameters<Injector['isResolved']>[0])
            ? owner.get(token as Parameters<Injector['get']>[0])
            : undefined,
        set: (token: unknown, value: unknown) => {
          owner.bind(token as Parameters<Injector['bind']>[0], () => value as never)
        },
      }
    },
    configurable: true,
  })
}

type StoreTokenWithModel = { model: Constructable<unknown>; primaryKey: never }

const storeTokensByModel = new Map<Constructable<unknown>, StoreTokenWithModel[]>()

const allStoreTokens: Record<string, unknown> = {
  ...DataStoreTokens,
  ...LogStoreTokens,
  // Reuse the same in-memory binding for the security / rest-service throw-by-default
  // store tokens so legacy `addStore(injector, new InMemoryStore({ model: User, ... }))`
  // calls in tests wire authentication stores correctly without a separate
  // `bindAuthenticationStores(injector)` call.
  RestServiceUserStore,
  RestServiceSessionStore,
  SecurityPasswordCredentialStore,
  SecurityPasswordResetTokenStore,
}

for (const [name, value] of Object.entries(allStoreTokens)) {
  if (!name.endsWith('Store')) continue
  const token = value as { model?: Constructable<unknown> }
  if (token.model) {
    const existing = storeTokensByModel.get(token.model) ?? []
    existing.push(token as StoreTokenWithModel)
    storeTokensByModel.set(token.model, existing)
  }
}

const dataSetTokenByModel = new Map<Constructable<unknown>, DataSetToken<unknown, never>>()

for (const [name, value] of Object.entries(allStoreTokens)) {
  if (!name.endsWith('DataSet')) continue
  const token = value as DataSetToken<unknown, never>
  if (token.model) {
    dataSetTokenByModel.set(token.model, token)
  }
}

/**
 * Backwards-compatible store registration helper. Looks up the matching
 * `<Model>Store` token and rebinds it to the supplied physical store.
 */
type AddStoreReturn = {
  addStore: <T, TPK extends keyof T>(store: PhysicalStore<T, TPK>) => AddStoreReturn
  getStoreFor: <T, TPK extends keyof T>(model: Constructable<T>, primaryKey: TPK) => PhysicalStore<T, TPK> | undefined
}

/**
 * Permissive IdentityContext used by the `addStore` shim so legacy tests that
 * never installed an authenticator continue to bypass DataSet authorization.
 */
const permissiveIdentityContext: IdentityContext = {
  isAuthenticated: () => Promise.resolve(true),
  isAuthorized: () => Promise.resolve(true),
  getCurrentUser: <TUser extends User>() => Promise.resolve({ username: 'test', roles: ['admin'] } as unknown as TUser),
}

export const addStore = <T, TPK extends keyof T>(injector: Injector, store: PhysicalStore<T, TPK>): AddStoreReturn => {
  const { model } = store as unknown as { model: Constructable<unknown> }
  const tokens = storeTokensByModel.get(model)
  if (!tokens || tokens.length === 0) {
    throw new Error(
      `addStore shim: no registered store token for model "${model.name}". Add it to app-models/data-store/tokens.ts.`,
    )
  }
  for (const token of tokens) {
    injector.bind(token as unknown as Parameters<Injector['bind']>[0], () => store as never)
  }
  if (!injector.isResolved(IdentityContext)) {
    injector.bind(IdentityContext, () => permissiveIdentityContext)
  }
  return getStoreManager(injector)
}

/** Shim for legacy `getStoreManager(injector)` callsites — stores live as tokens. */
export const getStoreManager = (injector: Injector): AddStoreReturn => ({
  addStore: <T, TPK extends keyof T>(store: PhysicalStore<T, TPK>) => addStore(injector, store),
  getStoreFor: <T, TPK extends keyof T>(model: Constructable<T>, _primaryKey: TPK) => {
    const tokens = storeTokensByModel.get(model)
    const token = tokens?.[0] as unknown as Parameters<Injector['get']>[0] | undefined
    if (!token) return undefined
    return injector.get(token) as PhysicalStore<T, TPK>
  },
})

export type AuthorizedDataSetCallback = (options: { injector: Injector }) => Promise<AuthorizationResult>

/**
 * Backwards-compatible repository facade. `getDataSetFor` resolves the
 * registered token; `createDataSet` is a no-op since DataSets are declared
 * as tokens at module scope.
 */
export const legacyRepositoryWithCreate = (injector: Injector) => ({
  getDataSetFor: <T, TPK extends keyof T>(model: Constructable<T>, _pk: TPK): DataSet<T, TPK> => {
    const token = dataSetTokenByModel.get(model)
    if (!token) {
      throw new Error(`legacyRepository shim: no registered DataSet token for model "${model.name}".`)
    }
    return injector.get(token as DataSetToken<T, TPK>)
  },
  createDataSet: <T, TPK extends keyof T>(_model: Constructable<T>, _pk: TPK, _settings?: unknown): void => {
    // No-op: DataSets are declared as singleton tokens. Calling `createDataSet`
    // in a test no longer registers anything; the dataset already exists.
  },
})

export const InMemoryStoreShim = InMemoryStore
