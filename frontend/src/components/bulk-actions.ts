import type { Injector } from '@furystack/inject'
import type { NotyService } from '@furystack/shades-common-components'
import type { AppliedServiceFile, ServiceView } from 'common'

import { ServicesApiClient } from '../services/api-clients/services-api-client.js'

type BulkApplyResult = {
  serviceName: string
  applied: AppliedServiceFile[]
}

/**
 * Builds the body for the user-facing warning Noty that lists every file
 * with at least one unresolved `{{NAME}}` placeholder, grouped by service.
 * Returns `null` when no service has any unresolved placeholder so the
 * caller can skip emitting the Noty entirely.
 */
export const formatUnresolvedSummary = (results: BulkApplyResult[]): string | null => {
  const lines = results
    .filter((r) => r.applied.some((a) => a.unresolved.length > 0))
    .map((r) => {
      const files = r.applied
        .filter((a) => a.unresolved.length > 0)
        .map((a) => `${a.relativePath}: ${a.unresolved.join(', ')}`)
        .join(' • ')
      return `${r.serviceName} — ${files}`
    })
  return lines.length > 0 ? lines.join('\n') : null
}

/**
 * Calls `/services/:id/apply-files` for each selected service and surfaces
 * the outcome via {@link NotyService}: a single success Noty when at least
 * one service succeeded, an aggregated warning Noty listing unresolved
 * template placeholders (grouped by service), and an error Noty listing any
 * services that failed outright. Failures on one service do not abort the
 * rest — every selection is attempted.
 */
export const bulkApplyFiles = async (
  injector: Injector,
  noty: NotyService,
  selection: readonly ServiceView[],
): Promise<void> => {
  const api = injector.get(ServicesApiClient)
  const failures: string[] = []
  const successes: BulkApplyResult[] = []

  for (const svc of selection) {
    try {
      const { result } = await api.call({
        method: 'POST',
        action: '/services/:id/apply-files',
        url: { id: svc.id },
        body: {},
      })
      successes.push({ serviceName: svc.displayName, applied: result.applied })
    } catch {
      failures.push(svc.displayName)
    }
  }

  if (successes.length > 0) {
    noty.emit('onNotyAdded', {
      title: 'Files applied',
      body: `Applied files for ${successes.length} service(s).`,
      type: 'success',
    })
  }
  const unresolvedSummary = formatUnresolvedSummary(successes)
  if (unresolvedSummary) {
    noty.emit('onNotyAdded', {
      title: 'Unresolved template placeholders',
      body: `Add the missing variables to the stack environment to interpolate them on next apply.\n${unresolvedSummary}`,
      type: 'warning',
    })
  }
  if (failures.length > 0) {
    noty.emit('onNotyAdded', {
      title: 'Apply files failed',
      body: `Failed for: ${failures.join(', ')}`,
      type: 'error',
    })
  }
}
