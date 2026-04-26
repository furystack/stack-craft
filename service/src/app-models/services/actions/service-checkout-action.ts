import { RequestError } from '@furystack/rest'
import { JsonResult, type RequestAction } from '@furystack/rest-service'
import type { ServiceCheckoutEndpoint } from 'common'
import { ServiceDefinition, ServiceStatus } from 'common'
import { GitHeadWatcher } from '../../../services/git-head-watcher.js'
import { GitService } from '../../../services/git-service.js'
import { resolveServiceCwd } from '../../../utils/resolve-service-cwd.js'
import { legacyRepository as getRepository } from '../../../utils/legacy-repository.js'

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

  const cwd = await resolveServiceCwd(injector, svc, injector)
  const git = injector.get(GitService)

  const localBranch = branch.replace(/^origin\//, '')

  try {
    await git.checkout(cwd, localBranch)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Checkout failed'
    throw new RequestError(`Failed to checkout branch "${localBranch}": ${message}`, 409)
  }

  await injector.get(GitHeadWatcher).watch(serviceId, cwd)

  return JsonResult({ success: true, serviceId })
}
