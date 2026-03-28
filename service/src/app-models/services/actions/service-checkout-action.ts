import { getCurrentUser } from '@furystack/core'
import { getRepository } from '@furystack/repository'
import { RequestError } from '@furystack/rest'
import { JsonResult, type RequestAction } from '@furystack/rest-service'
import type { ServiceCheckoutEndpoint } from 'common'
import { ServiceDefinition, ServiceStatus } from 'common'
import { GitService } from '../../../services/git-service.js'
import { ProcessManager } from '../../../services/process-manager.js'
import { resolveServiceCwd } from '../../../utils/resolve-service-cwd.js'

export const ServiceCheckoutAction: RequestAction<ServiceCheckoutEndpoint> = async ({
  injector,
  getUrlParams,
  getBody,
}) => {
  const { id: serviceId } = getUrlParams()
  const { branch } = await getBody()
  const repo = getRepository(injector)

  const services = await repo
    .getDataSetFor(ServiceDefinition, 'id')
    .find(injector, { filter: { id: { $eq: serviceId } }, top: 1 })
  const svc = services[0]
  if (!svc) throw new RequestError('Service not found', 404)

  const statuses = await repo
    .getDataSetFor(ServiceStatus, 'serviceId')
    .find(injector, { filter: { serviceId: { $eq: serviceId } }, top: 1 })
  const status = statuses[0]
  if (!status || status.cloneStatus !== 'cloned') {
    throw new RequestError('Repository is not cloned yet', 400)
  }

  const cwd = await resolveServiceCwd(injector, svc)
  const git = injector.getInstance(GitService)
  const pm = injector.getInstance(ProcessManager)

  await git.checkout(cwd, branch)

  const currentBranch = await git.getCurrentBranch(cwd)

  let username = 'unknown'
  try {
    const { username: resolvedUsername } = (await getCurrentUser(injector)) ?? {}
    if (resolvedUsername) username = resolvedUsername
  } catch {
    // Identity context may not be available
  }

  await pm.updateBranch(serviceId, currentBranch, {
    triggeredBy: username,
    triggerSource: 'api',
  })

  return JsonResult({ success: true, serviceId })
}
