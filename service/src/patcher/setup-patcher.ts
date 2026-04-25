import { useSystemIdentityContext } from '@furystack/core'
import type { Injector } from '@furystack/inject'
import { getLogger } from '@furystack/logging'
import { getRepository } from '@furystack/repository'
import { useSequelize } from '@furystack/sequelize-store'
import { PatchRun, ServiceStatus } from 'common'
import { DataTypes, Model } from 'sequelize'

import { authorizedDataSet } from '../config.js'
import { getDbOptions } from '../app-models/data-store/db-options.js'
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

/**
 * Registers the PatchRun data set and runs any pending patches.
 * Must be invoked after the main data store has been configured.
 */
export const setupPatcher = async (injector: Injector): Promise<void> => {
  const logger = getLogger(injector).withScope('Patcher')

  useSequelize({
    injector,
    model: PatchRun,
    sequelizeModel: PatchRunModel,
    primaryKey: 'id',
    options: getDbOptions(),
    initModel: async (sequelize) => {
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
    },
  })

  const repo = getRepository(injector)
  repo.createDataSet(PatchRun, 'id', { ...authorizedDataSet })

  const systemInjector = useSystemIdentityContext({ injector, username: 'patcher' })
  try {
    // Force eager initialization of the main Sequelize models. `useSequelize` registers
    // initModel lazily (triggered on first data-set operation). Patches may need a fully
    // initialized model (e.g. `ServiceStatusModel.sequelize`, `.getAttributes()`), so we
    // trigger a lightweight query to run `initAllModels` before the first patch.
    await repo.getDataSetFor(ServiceStatus, 'serviceId').count(systemInjector)

    const patchRunDataSet = repo.getDataSetFor(PatchRun, 'id')

    await checkForOrphanedPatch(systemInjector, patchRunDataSet)

    for (const patchInstance of patchList) {
      await runPatch(systemInjector, patchInstance, patchRunDataSet)
    }

    await logger.information({ message: `Patcher finished. ${patchList.length} patch(es) checked.` })
  } finally {
    await systemInjector[Symbol.asyncDispose]()
  }
}
