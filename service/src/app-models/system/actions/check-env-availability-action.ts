import { JsonResult, type RequestAction } from '@furystack/rest-service'
import type { CheckEnvAvailabilityEndpoint } from 'common'

export const CheckEnvAvailabilityAction: RequestAction<CheckEnvAvailabilityEndpoint> = async ({ getBody }) => {
  const { variableNames } = await getBody()
  const result: Record<string, boolean> = {}
  for (const name of variableNames) {
    result[name] = process.env[name] !== undefined
  }
  return JsonResult(result)
}
