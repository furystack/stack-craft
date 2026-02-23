import type { RestApi } from '@furystack/rest'

export type CheckEnvAvailabilityEndpoint = {
  result: Record<string, boolean>
  body: { variableNames: string[] }
}

export interface SystemApi extends RestApi {
  POST: {
    '/system/check-env-availability': CheckEnvAvailabilityEndpoint
  }
}
