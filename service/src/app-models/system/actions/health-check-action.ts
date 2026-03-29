import { JsonResult, type RequestAction } from '@furystack/rest-service'
import type { HealthCheckEndpoint, HealthCheckResult } from 'common'

const startTime = Date.now()

export const HealthCheckAction: RequestAction<HealthCheckEndpoint> = async ({ injector }) => {
  let database: HealthCheckResult['database'] = 'disconnected'
  try {
    const { Sequelize } = await import('sequelize')
    const sequelize = injector.cachedSingletons.get(Sequelize) as InstanceType<typeof Sequelize> | undefined
    if (sequelize) {
      await sequelize.authenticate()
      database = 'connected'
    }
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
