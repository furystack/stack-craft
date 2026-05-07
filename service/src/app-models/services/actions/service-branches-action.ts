import { RequestError } from '@furystack/rest'
import { JsonResult, type RequestAction } from '@furystack/rest-service'
import type { ServiceBranchesEndpoint } from 'common'
import { ServiceDefinition, ServiceStatus } from 'common'
import { existsSync } from 'fs'
import { join } from 'path'
import { GitService } from '../../../services/git-service.js'
import { resolveServiceCwd } from '../../../utils/resolve-service-cwd.js'
import { legacyRepository as getRepository } from '../../../utils/legacy-repository.js'

export const ServiceBranchesAction: RequestAction<ServiceBranchesEndpoint> = async ({ injector, getUrlParams }) => {
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
  const cloneStatus = status?.cloneStatus

  if (cloneStatus !== 'cloned' && cloneStatus !== 'cloning') {
    throw new RequestError('Repository is not cloned yet', 400)
  }

  const cwd = await resolveServiceCwd(injector, svc, injector)

  // Allow reads while a pull/refresh is mid-flight on an already-cloned repo;
  // git ref scans are read-only and safe to run concurrently with `git fetch`.
  // For the `cloning` state, require a `.git` directory on disk so we don't
  // race the initial clone.
  if (cloneStatus === 'cloning' && !existsSync(join(cwd, '.git'))) {
    throw new RequestError('Repository is not cloned yet', 400)
  }

  const git = injector.get(GitService)

  const [currentBranch, branches] = await Promise.all([git.getCurrentBranch(cwd), git.getBranches(cwd)])

  return JsonResult({
    currentBranch,
    local: branches.local,
    remote: branches.remote,
  })
}
