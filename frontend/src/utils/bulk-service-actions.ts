import type { Injector } from '@furystack/inject'
import { NotyService } from '@furystack/shades-common-components'
import type { ServiceView } from 'common'

import { ServicesApiClient } from '../services/api-clients/services-api-client.js'
import { isServiceReady } from './is-service-ready.js'

type BulkServiceAction = 'start' | 'stop' | 'update'

const actionFailureTitle: Record<BulkServiceAction, string> = {
  start: 'Start failed',
  stop: 'Stop failed',
  update: 'Update failed',
}

const shouldIncludeService = (svc: ServiceView, action: BulkServiceAction): boolean => {
  if (action === 'start') return isServiceReady(svc) && svc.runStatus === 'stopped'
  if (action === 'stop') return svc.runStatus === 'running'
  return Boolean(svc.repositoryId && svc.cloneStatus === 'cloned')
}

/**
 * Runs a bulk start, stop, or update across the given services. Failures are
 * collected and reported via a single error Noty; one failure does not abort
 * the rest.
 */
export const runBulkServiceAction = async (
  injector: Injector,
  services: readonly ServiceView[],
  action: BulkServiceAction,
): Promise<void> => {
  const api = injector.get(ServicesApiClient)
  const noty = injector.get(NotyService)
  const targets = services.filter((svc) => shouldIncludeService(svc, action))
  const failures: string[] = []

  for (const svc of targets) {
    try {
      await api.call({
        method: 'POST',
        action: `/services/:id/${action}`,
        url: { id: svc.id },
      })
    } catch {
      failures.push(svc.displayName)
    }
  }

  if (failures.length > 0) {
    noty.emit('onNotyAdded', {
      title: actionFailureTitle[action],
      body: `Failed for: ${failures.join(', ')}`,
      type: 'error',
    })
  }
}
