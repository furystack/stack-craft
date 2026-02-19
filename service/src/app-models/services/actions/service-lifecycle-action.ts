import { existsSync, mkdirSync, rmSync } from 'fs'
import { dirname, join, resolve } from 'path'

import { getLogger } from '@furystack/logging'
import { resolvePath } from '../../../utils/resolve-path.js'
import { getRepository } from '@furystack/repository'
import { RequestError } from '@furystack/rest'
import { JsonResult, type RequestAction } from '@furystack/rest-service'
import type { ServiceActionEndpoint } from 'common'
import { GitHubRepository, Service, Stack } from 'common'
import { getServiceCwd } from 'common'
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
          const stackDs = repository.getDataSetFor(Stack, 'name')
          const repoDs = repository.getDataSetFor(GitHubRepository, 'id')

          const svcs = await serviceDs.find(injector, { filter: { id: { $eq: serviceId } }, top: 1 })
          const svc = svcs[0]
          if (!svc) throw new RequestError('Service not found', 404)

          const stacks = await stackDs.find(injector, {
            filter: { name: { $eq: svc.stackName } },
            top: 1,
          })
          const stack = stacks[0]
          if (!stack) throw new RequestError(`Stack not found: ${svc.stackName}`, 404)

          let repo: GitHubRepository | null = null
          if (svc.repositoryId) {
            const repos = await repoDs.find(injector, {
              filter: { id: { $eq: svc.repositoryId } },
              top: 1,
            })
            repo = repos[0] ?? null
          }

          if (!repo?.url) {
            throw new RequestError(`No repository linked. Link a GitHub repository to enable clone/pull.`, 400)
          }

          const cwd = resolvePath(getServiceCwd(stack, svc, repo))
          const stackRoot = resolve(resolvePath(stack.mainDirectory))
          if (!cwd.startsWith(stackRoot)) {
            throw new RequestError(`Resolved path "${cwd}" is outside the stack directory "${stackRoot}"`, 400)
          }

          const git = injector.getInstance(GitService)
          const isGitRepo = existsSync(cwd) && existsSync(join(cwd, '.git'))

          if (!existsSync(cwd)) {
            await logger.information({
              message: `Working directory missing, cloning ${repo.url} into ${cwd}`,
            })
            mkdirSync(dirname(cwd), { recursive: true })
            await git.clone(repo.url, cwd)
          } else if (isGitRepo) {
            await git.pull(cwd)
          } else {
            await logger.information({
              message: `Working directory exists but is not a git repo, removing and cloning ${repo.url} into ${cwd}`,
            })
            rmSync(cwd, { recursive: true })
            mkdirSync(dirname(cwd), { recursive: true })
            await git.clone(repo.url, cwd)
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
