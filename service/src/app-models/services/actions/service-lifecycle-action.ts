import { existsSync } from 'fs'

import { getLogger } from '@furystack/logging'
import { getRepository } from '@furystack/repository'
import { RequestError } from '@furystack/rest'
import { JsonResult, type RequestAction } from '@furystack/rest-service'
import type { ServiceActionEndpoint } from 'common'
import { GitHubRepository, Service } from 'common'
import { GitService } from '../../../services/git-service.js'
import { ProcessManager } from '../../../services/process-manager.js'

type LifecycleAction = 'start' | 'stop' | 'restart' | 'install' | 'build' | 'pull'

export const ServiceLifecycleAction =
  (action: LifecycleAction): RequestAction<ServiceActionEndpoint> =>
  async ({ injector, getUrlParams }) => {
    const logger = getLogger(injector).withScope('ServiceLifecycle')
    const { id: serviceId } = getUrlParams()
    const pm = injector.getInstance(ProcessManager)

    await logger.information({ message: `Service lifecycle action: ${action} for service ${serviceId}` })

    try {
      switch (action) {
        case 'start':
          await pm.startService(serviceId)
          break
        case 'stop':
          await pm.stopService(serviceId)
          break
        case 'restart':
          await pm.restartService(serviceId)
          break
        case 'install':
          await pm.installService(serviceId)
          break
        case 'build':
          await pm.buildService(serviceId)
          break
        case 'pull': {
          const repository = getRepository(injector)
          const serviceDs = repository.getDataSetFor(Service, 'id')
          const svcs = await serviceDs.find(injector, { filter: { id: { $eq: serviceId } }, top: 1 })
          const svc = svcs[0]
          if (!svc?.workingDirectory) throw new RequestError('Service has no working directory', 400)

          const git = injector.getInstance(GitService)

          if (!existsSync(svc.workingDirectory)) {
            if (!svc.repositoryId) {
              throw new RequestError(
                `Working directory does not exist and no repository is linked. Link a GitHub repository to enable cloning.`,
                400,
              )
            }
            const repoDs = repository.getDataSetFor(GitHubRepository, 'id')
            const repos = await repoDs.find(injector, {
              filter: { id: { $eq: svc.repositoryId } },
              top: 1,
            })
            const repo = repos[0]
            if (!repo?.url) {
              throw new RequestError(`Linked repository not found or has no URL.`, 400)
            }
            await logger.information({
              message: `Working directory missing, cloning ${repo.url} into ${svc.workingDirectory}`,
            })
            await git.clone(repo.url, svc.workingDirectory)
          } else {
            await git.pull(svc.workingDirectory)
          }
          break
        }
        default: {
          const _exhaustive: never = action
          throw new RequestError(`Unknown action: ${String(_exhaustive)}`, 400)
        }
      }
    } catch (error) {
      if (error instanceof RequestError) throw error
      const message = error instanceof Error ? error.message : 'Unknown error'
      throw new RequestError(message, 500)
    }

    return JsonResult({ success: true, serviceId })
  }
