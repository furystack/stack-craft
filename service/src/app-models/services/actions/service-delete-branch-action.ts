import { getRepository } from '@furystack/repository'
import { RequestError } from '@furystack/rest'
import { JsonResult, type RequestAction } from '@furystack/rest-service'
import type { ServiceDeleteBranchEndpoint } from 'common'
import { ServiceDefinition, ServiceGitStatus, ServiceStatus } from 'common'

import { GitHeadWatcher } from '../../../services/git-head-watcher.js'
import { GitService } from '../../../services/git-service.js'
import { resolveServiceCwd } from '../../../utils/resolve-service-cwd.js'

/**
 * Deletes a local branch in the service's git repository.
 * When the service is currently on the target branch, switches to `switchTo`
 * (or the remote default branch) first.
 */
export const ServiceDeleteBranchAction: RequestAction<ServiceDeleteBranchEndpoint> = async ({
  injector,
  getUrlParams,
  getBody,
}) => {
  const { id: serviceId } = getUrlParams()
  const { branch, switchTo, force } = await getBody()
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
  const git = injector.getInstance(GitService)

  const localBranch = branch.replace(/^origin\//, '')

  let switchedTo: string | undefined
  let currentBranch: string | undefined
  try {
    currentBranch = await git.getCurrentBranch(cwd)
  } catch {
    currentBranch = undefined
  }

  if (currentBranch === localBranch) {
    const target = switchTo?.replace(/^origin\//, '') ?? (await git.getDefaultBranch(cwd))
    if (!target) {
      throw new RequestError(`Cannot delete branch "${localBranch}" while it is checked out. Provide "switchTo".`, 409)
    }
    try {
      await git.checkout(cwd, target)
      switchedTo = target
    } catch (error) {
      throw new RequestError(
        `Failed to switch to "${target}" before deleting "${localBranch}": ${error instanceof Error ? error.message : 'unknown'}`,
        409,
      )
    }
  }

  try {
    await git.deleteLocalBranch(cwd, localBranch, force ?? false)
  } catch (error) {
    throw new RequestError(
      `Failed to delete branch "${localBranch}": ${error instanceof Error ? error.message : 'unknown'}`,
      409,
    )
  }

  // Clear any cached `upstream-gone` marker since the branch no longer exists locally either.
  try {
    const gitStatusDs = repo.getDataSetFor(ServiceGitStatus, 'serviceId')
    await gitStatusDs.update(injector, serviceId, { upstreamStatus: 'unknown', warningsDismissed: {} })
  } catch {
    // non-fatal
  }

  await injector.getInstance(GitHeadWatcher).watch(serviceId, cwd)

  return JsonResult({
    success: true,
    serviceId,
    deleted: localBranch,
    ...(switchedTo !== undefined ? { switchedTo } : {}),
  })
}
