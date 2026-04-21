import { getRepository } from '@furystack/repository'
import { RequestError } from '@furystack/rest'
import { JsonResult, type RequestAction } from '@furystack/rest-service'
import type { ServiceDismissWarningEndpoint, ServiceWarningKind } from 'common'
import { ServiceDefinition, ServiceGitStatus } from 'common'

/**
 * Records that the user has dismissed an inline warning (upstream-gone or stale)
 * for a service. The flag lives in the in-memory `ServiceGitStatus` and resets
 * on service restart.
 */
export const ServiceDismissWarningAction: RequestAction<ServiceDismissWarningEndpoint> = async ({
  injector,
  getUrlParams,
  getBody,
}) => {
  const { id: serviceId } = getUrlParams()
  const { kind } = await getBody()
  const repo = getRepository(injector)

  const services = await repo
    .getDataSetFor(ServiceDefinition, 'id')
    .find(injector, { filter: { id: { $eq: serviceId } }, top: 1 })
  if (!services[0]) throw new RequestError('Service not found', 404)

  const gitStatusDs = repo.getDataSetFor(ServiceGitStatus, 'serviceId')
  const existing = await gitStatusDs.find(injector, { filter: { serviceId: { $eq: serviceId } }, top: 1 })
  const current = existing[0]

  const flag = flagKeyFor(kind)
  const nextDismissals = { ...(current?.warningsDismissed ?? {}), [flag]: true }

  if (current) {
    await gitStatusDs.update(injector, serviceId, { warningsDismissed: nextDismissals })
  } else {
    await gitStatusDs.add(injector, { serviceId, warningsDismissed: nextDismissals })
  }

  return JsonResult({ success: true, serviceId })
}

const flagKeyFor = (kind: ServiceWarningKind): 'upstreamGone' | 'stale' => {
  switch (kind) {
    case 'upstream-gone':
      return 'upstreamGone'
    case 'stale':
      return 'stale'
    default:
      return kind
  }
}
