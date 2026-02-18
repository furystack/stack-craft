import { getStoreManager } from '@furystack/core'
import { getLogger } from '@furystack/logging'
import { RequestError } from '@furystack/rest'
import { JsonResult, type RequestAction } from '@furystack/rest-service'
import type { ServiceActionEndpoint } from 'common'
import { Service } from 'common'
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
          const sm = getStoreManager(injector)
          const svcs = await sm.getStoreFor(Service, 'id').find({ filter: { id: { $eq: serviceId } }, top: 1 })
          const svc = svcs[0]
          if (!svc?.workingDirectory) throw new RequestError('Service has no working directory', 400)
          await injector.getInstance(GitService).pull(svc.workingDirectory)
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
