import { useSystemIdentityContext } from '@furystack/core'
import type { Injector } from '@furystack/inject'
import { getLogger } from '@furystack/logging'
import { defineDataSet } from '@furystack/repository'
import { defineSequelizeStore } from '@furystack/sequelize-store'
import { PatchRun } from 'common'
import type { Sequelize } from 'sequelize'
import { DataTypes, Model } from 'sequelize'

import { getDbOptions } from '../app-models/data-store/db-options.js'
import { ServiceStatusDataSet } from '../app-models/data-store/tokens.js'
import { authorizedDataSet } from '../auth-data-set.js'
import { patchList } from './0000-patch-list.js'
import { checkForOrphanedPatch } from './check-for-orphaned-patch.js'
import { runPatch } from './run-patch.js'

class PatchRunModel extends Model<PatchRun, PatchRun> implements PatchRun {
  declare id: string
  declare createdAt: Date
  declare patchId: string
  declare name: string
  declare description: string
  declare status: PatchRun['status']
  declare updatedAt: Date
  declare log: Array<{ timestamp: string; message: string }>
}

const initPatchRunModel = async (sequelize: Sequelize): Promise<void> => {
  PatchRunModel.init(
    {
      id: {
        type: DataTypes.UUID,
        primaryKey: true,
        defaultValue: () => crypto.randomUUID(),
      },
      patchId: { type: DataTypes.STRING, allowNull: false },
      name: { type: DataTypes.STRING, allowNull: false },
      description: { type: DataTypes.TEXT, allowNull: true },
      status: {
        type: DataTypes.ENUM('running', 'success', 'failed', 'orphaned'),
        allowNull: false,
        defaultValue: 'running',
      },
      log: { type: DataTypes.JSONB, defaultValue: [] },
      createdAt: { type: DataTypes.DATE },
      updatedAt: { type: DataTypes.DATE },
    },
    { sequelize, indexes: [{ fields: ['patchId'] }, { fields: ['status'] }] },
  )
  await PatchRunModel.sync()
}

// Lazy proxy so importing this module does not require `DATABASE_URL` to be set
// (e.g. in unit tests that bind the store token to an in-memory implementation).
// `ownKeys` / `getOwnPropertyDescriptor` traps are required so that
// `JSON.stringify(options)` and `{ ...options }` inside `SequelizeClientFactory`
// observe the underlying option keys (Sequelize otherwise rejects with
// "Dialect needs to be explicitly supplied as of v4.0.0").
let cachedPatcherOptions: ReturnType<typeof getDbOptions> | null = null
const resolvePatcherOptions = (): ReturnType<typeof getDbOptions> => {
  if (!cachedPatcherOptions) {
    cachedPatcherOptions = getDbOptions()
  }
  return cachedPatcherOptions
}

const lazyDbOptions = new Proxy(
  {},
  {
    get: (_target, prop) => resolvePatcherOptions()[prop as keyof ReturnType<typeof getDbOptions>],
    has: (_target, prop) => prop in resolvePatcherOptions(),
    ownKeys: () => Reflect.ownKeys(resolvePatcherOptions()),
    getOwnPropertyDescriptor: (_target, prop) => Reflect.getOwnPropertyDescriptor(resolvePatcherOptions(), prop),
  },
) as ReturnType<typeof getDbOptions>

export const PatchRunStoreToken = defineSequelizeStore({
  name: 'app/PatchRunStore',
  model: PatchRun,
  sequelizeModel: PatchRunModel,
  primaryKey: 'id',
  options: lazyDbOptions,
  initModel: initPatchRunModel,
})

export const PatchRunDataSet = defineDataSet({
  name: 'app/PatchRunDataSet',
  store: PatchRunStoreToken,
  settings: { ...authorizedDataSet },
})

/**
 * Runs any pending patches against the configured PatchRun data set. Must be
 * invoked after the main data store has been configured.
 */
export const setupPatcher = async (injector: Injector): Promise<void> => {
  const logger = getLogger(injector).withScope('Patcher')

  const systemInjector = useSystemIdentityContext({ injector, username: 'patcher' })
  try {
    // Force eager initialization of the main Sequelize models so patches that
    // need fully initialized models (e.g. `ServiceStatusModel.sequelize`,
    // `.getAttributes()`) work correctly.
    await systemInjector.get(ServiceStatusDataSet).count(systemInjector)

    const patchRunDataSet = systemInjector.get(PatchRunDataSet)

    await checkForOrphanedPatch(systemInjector, patchRunDataSet)

    for (const patchInstance of patchList) {
      await runPatch(systemInjector, patchInstance, patchRunDataSet)
    }

    await logger.information({ message: `Patcher finished. ${patchList.length} patch(es) checked.` })
  } finally {
    await systemInjector[Symbol.asyncDispose]()
  }
}
