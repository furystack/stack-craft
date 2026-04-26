import type { Constructable, WithOptionalId } from '@furystack/core'
import type { Injector } from '@furystack/inject'
import type { DataSet, DataSetToken } from '@furystack/repository'

import * as DataStoreTokens from '../app-models/data-store/tokens.js'
import * as LogStoreTokens from '../app-models/logs/setup-log-store.js'

const tokenRegistry = new Map<Constructable<unknown>, DataSetToken<unknown, never>>()

const registerAll = (mod: Record<string, unknown>): void => {
  for (const [name, value] of Object.entries(mod)) {
    if (!name.endsWith('DataSet')) continue
    const token = value as DataSetToken<unknown, never>
    if (token.model) {
      tokenRegistry.set(token.model, token)
    }
  }
}

registerAll(DataStoreTokens)
registerAll(LogStoreTokens)

/**
 * Backward-compatibility shim for the removed `Repository` facade. Resolves
 * the registered {@link DataSetToken} for the supplied model and returns its
 * {@link DataSet}.
 *
 * Prefer importing the explicit DataSet token and calling
 * `getDataSetFor(injector, token)` from `@furystack/repository` for new code.
 */
export const legacyRepository = (injector: Injector) => ({
  getDataSetFor: <T, TPrimaryKey extends keyof T, TWritableData = WithOptionalId<T, TPrimaryKey>>(
    model: Constructable<T>,
    _primaryKey: TPrimaryKey,
  ): DataSet<T, TPrimaryKey, TWritableData> => {
    const token = tokenRegistry.get(model)
    if (!token) {
      throw new Error(
        `No DataSet token registered for model "${model.name}". Declare one in app-models/data-store/tokens.ts.`,
      )
    }
    return injector.get(token as DataSetToken<T, TPrimaryKey, TWritableData>)
  },
  /**
   * No-op shim for legacy `repository.createDataSet(Model, 'pk', settings)`
   * callsites — DataSets are now declared as singleton tokens at module scope
   * (see `app-models/data-store/tokens.ts`).
   */
  createDataSet: <T, TPrimaryKey extends keyof T>(
    _model: Constructable<T>,
    _primaryKey: TPrimaryKey,
    _settings?: unknown,
  ): void => {
    // intentionally empty
  },
})
