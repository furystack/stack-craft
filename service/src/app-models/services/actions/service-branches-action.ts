import { getRepository } from '@furystack/repository'
import { RequestError } from '@furystack/rest'
import { JsonResult, type RequestAction } from '@furystack/rest-service'
import type { ServiceBranchesEndpoint } from 'common'
import { ServiceDefinition, ServiceStatus } from 'common'
import { GitService } from '../../../services/git-service.js'
import { resolveServiceCwd } from '../../../utils/resolve-service-cwd.js'

export const ServiceBranchesAction: RequestAction<ServiceBranchesEndpoint> = async ({
  injector,
  getUrlParams,
}) => {
  const { id: serviceId } = getUrlParams()
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

  const [currentBranch, branches] = await Promise.all([
    git.getCurrentBranch(cwd),
    git.getBranches(cwd),
  ])

  return JsonResult({
    currentBranch,
    local: branches.local,
    remote: branches.remote,
  })
}
