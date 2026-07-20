import type { Palette } from '@furystack/shades-common-components'
import type { RunStatus, ServiceView } from 'common'

export type StackRunSummaryStatus = 'empty' | 'stopped' | 'transitional' | 'running' | 'error'

export type StackRunSummary = {
  status: StackRunSummaryStatus
  running: number
  stopped: number
  error: number
  transitional: number
  total: number
}

const isTransitional = (runStatus: RunStatus): boolean => runStatus === 'starting' || runStatus === 'stopping'

/**
 * Derives a single stack-level run summary from its services.
 * Precedence: error > transitional > running > stopped > empty.
 */
export const getStackRunSummary = (services: ServiceView[]): StackRunSummary => {
  const running = services.filter((s) => s.runStatus === 'running').length
  const stopped = services.filter((s) => s.runStatus === 'stopped').length
  const error = services.filter((s) => s.runStatus === 'error').length
  const transitional = services.filter((s) => isTransitional(s.runStatus)).length
  const total = services.length

  const status: StackRunSummaryStatus =
    total === 0
      ? 'empty'
      : error > 0
        ? 'error'
        : transitional > 0
          ? 'transitional'
          : running > 0
            ? 'running'
            : 'stopped'

  return { status, running, stopped, error, transitional, total }
}

export const getStackStatusPaletteKey = (status: StackRunSummaryStatus): keyof Palette => {
  switch (status) {
    case 'error':
      return 'error'
    case 'transitional':
      return 'warning'
    case 'running':
      return 'success'
    case 'stopped':
    case 'empty':
      return 'secondary'
    default:
      return 'secondary'
  }
}

/** Human-readable tooltip for sidebar / dashboard status indicators. */
export const formatStackRunSummaryTooltip = (summary: StackRunSummary): string => {
  if (summary.total === 0) {
    return 'No services'
  }

  const parts: string[] = []
  if (summary.running > 0) {
    parts.push(`${summary.running} running`)
  }
  if (summary.transitional > 0) {
    parts.push(`${summary.transitional} starting/stopping`)
  }
  if (summary.stopped > 0) {
    parts.push(`${summary.stopped} stopped`)
  }
  if (summary.error > 0) {
    parts.push(`${summary.error} error`)
  }

  return parts.join(', ')
}
