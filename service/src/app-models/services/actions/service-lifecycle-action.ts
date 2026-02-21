import { getCurrentUser } from '@furystack/core'
import { getLogger } from '@furystack/logging'
import { RequestError } from '@furystack/rest'
import { JsonResult, type RequestAction } from '@furystack/rest-service'
import type { ServiceActionEndpoint } from 'common'
import { ProcessManager } from '../../../services/process-manager.js'

type LifecycleAction = 'start' | 'stop' | 'restart' | 'install' | 'build' | 'pull' | 'setup' | 'update'

export const ServiceLifecycleAction =
  (action: LifecycleAction): RequestAction<ServiceActionEndpoint> =>
  async ({ injector, getUrlParams }) => {
    const logger = getLogger(injector).withScope('ServiceLifecycle')
    const { id: serviceId } = getUrlParams()
    const pm = injector.getInstance(ProcessManager)
    let username = 'unknown'
    try {
      const { username: resolvedUsername } = (await getCurrentUser(injector)) ?? {}
      if (resolvedUsername) username = resolvedUsername
    } catch {
      // Identity context may not be available in non-HTTP contexts
    }
    const trigger = { triggeredBy: username, triggerSource: 'api' as const }

    await logger.information({ message: `Service lifecycle action: ${action} for service ${serviceId}` })

    try {
      switch (action) {
        case 'start':
          await pm.startService(serviceId, trigger)
          break
        case 'stop':
          await pm.stopService(serviceId, trigger)
          break
        case 'restart':
          await pm.restartService(serviceId, trigger)
          break
        case 'install':
          await pm.installService(serviceId, trigger)
          break
        case 'build':
          await pm.buildService(serviceId, trigger)
          break
        case 'pull':
          await pm.cloneOrPullService(serviceId, trigger)
          break
        case 'setup':
          await pm.setupService(serviceId, trigger)
          break
        case 'update':
          await pm.updateService(serviceId, trigger)
          break
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
