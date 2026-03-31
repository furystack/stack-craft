import { getLogger } from '@furystack/logging'
import { JsonResult, type RequestAction } from '@furystack/rest-service'
import type { CheckEnvAvailabilityEndpoint } from 'common'

export const CheckEnvAvailabilityAction: RequestAction<CheckEnvAvailabilityEndpoint> = async ({
  injector,
  getBody,
}) => {
  const { variableNames } = await getBody()
  const logger = getLogger(injector).withScope('CheckEnvAvailability')
  await logger.verbose({
    message: 'check-env-availability called',
    data: { variableNames },
  })
  const result: Record<string, boolean> = {}
  for (const name of variableNames) {
    result[name] = process.env[name] !== undefined
  }
  return JsonResult(result)
}
