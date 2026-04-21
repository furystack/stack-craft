import type { ModelAttributeColumnOptions, QueryInterface } from 'sequelize'

import { ServiceStatusModel } from '../app-models/data-store/models.js'
import type { Patch } from './patch.js'

/**
 * `ensureEnums` is a Postgres-only method exposed on the dialect-specific `QueryInterface`
 * but not declared in Sequelize's public TypeScript types.
 */
type PostgresQueryInterface = QueryInterface & {
  ensureEnums: (
    tableName: string,
    attributes: Record<string, ModelAttributeColumnOptions>,
    options: Record<string, unknown>,
    model: typeof ServiceStatusModel,
  ) => Promise<unknown>
}

/**
 * Reconciles the Postgres enum types backing `installStatus` and `buildStatus`
 * with the current `ServiceStatusModel` definition. New enum values (e.g. `'stale'`,
 * used to flag pipeline stages after external git changes) are added via
 * `ALTER TYPE ... ADD VALUE IF NOT EXISTS` under the hood.
 *
 * Delegates to Sequelize's `ensureEnums` so the enum name, ordering, and value
 * escaping stay in sync with the model and do not need to be hardcoded.
 */
export const addStaleStatusEnumPatch: Patch = {
  id: '0001-add-stale-status-enum',
  name: 'Add "stale" value to install/build status enums',
  description:
    'Reconciles the Postgres enum types for installStatus and buildStatus with the current model definition.',
  run: async (_injector, addLogEntry) => {
    const { sequelize } = ServiceStatusModel
    if (!sequelize) {
      throw new Error('Sequelize unavailable on ServiceStatusModel. Ensure data store is initialized first.')
    }

    const qi = sequelize.getQueryInterface() as PostgresQueryInterface
    const { installStatus, buildStatus } = ServiceStatusModel.getAttributes() as Record<
      string,
      ModelAttributeColumnOptions
    >

    addLogEntry('Ensuring installStatus + buildStatus enums match the model')
    await qi.ensureEnums(ServiceStatusModel.tableName, { installStatus, buildStatus }, {}, ServiceStatusModel)
    addLogEntry('Patch complete')
  },
}
