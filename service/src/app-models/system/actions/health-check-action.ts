import { JsonResult, type RequestAction } from '@furystack/rest-service'
import { SequelizeClientFactory } from '@furystack/sequelize-store'
import type { HealthCheckEndpoint, HealthCheckResult } from 'common'

import { getDbOptions } from '../../data-store/db-options.js'

const startTime = Date.now()

export const HealthCheckAction: RequestAction<HealthCheckEndpoint> = async ({ injector }) => {
  let database: HealthCheckResult['database']
  try {
    const factory = injector.get(SequelizeClientFactory)
    const sequelize = factory.getSequelizeClient(getDbOptions())
    await sequelize.authenticate()
    database = 'connected'
  } catch {
    database = 'disconnected'
  }

  return JsonResult({
    status: database === 'connected' ? 'ok' : 'degraded',
    uptime: Math.floor((Date.now() - startTime) / 1000),
    version: process.env.npm_package_version ?? '0.0.0',
    database,
  })
}
