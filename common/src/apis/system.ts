import type { RestApi } from '@furystack/rest'

/** Backend health status including uptime and database connectivity */
export type HealthCheckResult = {
  status: 'ok' | 'degraded'
  uptime: number
  version: string
  database: 'connected' | 'disconnected'
}

/** Returns the current health status of the service */
export type HealthCheckEndpoint = { result: HealthCheckResult }

/** Checks whether the specified environment variables are set on the host system */
export type CheckEnvAvailabilityEndpoint = {
  result: Record<string, boolean>
  body: { variableNames: string[] }
}

export interface SystemApi extends RestApi {
  GET: {
    '/system/health': HealthCheckEndpoint
  }
  POST: {
    '/system/check-env-availability': CheckEnvAvailabilityEndpoint
  }
}
