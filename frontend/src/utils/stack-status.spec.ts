// @vitest-environment node
import { describe, expect, it } from 'vitest'
import type { ServiceView } from 'common'

import { getStackRunSummary, getStackStatusPaletteKey, formatStackRunSummaryTooltip } from './stack-status.js'

const baseService: ServiceView = {
  id: 'svc-1',
  serviceId: 'svc-1',
  stackName: 'stack-1',
  displayName: 'Test Service',
  description: '',
  runCommand: 'npm start',
  prerequisiteIds: [],
  prerequisiteServiceIds: [],
  files: [],
  autoFetchEnabled: false,
  autoFetchIntervalMinutes: 60,
  autoRestartOnFetch: false,
  environmentVariableOverrides: {},
  localFiles: [],
  cloneStatus: 'not-cloned',
  installStatus: 'not-installed',
  buildStatus: 'not-built',
  runStatus: 'stopped',
  createdAt: '',
  updatedAt: '',
}

describe('getStackRunSummary', () => {
  it('should return empty when there are no services', () => {
    expect(getStackRunSummary([])).toEqual({
      status: 'empty',
      running: 0,
      stopped: 0,
      error: 0,
      transitional: 0,
      total: 0,
    })
  })

  it('should return stopped when all services are stopped', () => {
    const summary = getStackRunSummary([
      { ...baseService, id: 'a', runStatus: 'stopped' },
      { ...baseService, id: 'b', runStatus: 'stopped' },
    ])
    expect(summary.status).toBe('stopped')
    expect(summary.stopped).toBe(2)
  })

  it('should return running when any service is running and none errored or transitional', () => {
    const summary = getStackRunSummary([
      { ...baseService, id: 'a', runStatus: 'running' },
      { ...baseService, id: 'b', runStatus: 'stopped' },
    ])
    expect(summary.status).toBe('running')
    expect(summary.running).toBe(1)
  })

  it('should prefer transitional over running', () => {
    const summary = getStackRunSummary([
      { ...baseService, id: 'a', runStatus: 'running' },
      { ...baseService, id: 'b', runStatus: 'starting' },
    ])
    expect(summary.status).toBe('transitional')
    expect(summary.transitional).toBe(1)
  })

  it('should prefer error over transitional and running', () => {
    const summary = getStackRunSummary([
      { ...baseService, id: 'a', runStatus: 'running' },
      { ...baseService, id: 'b', runStatus: 'starting' },
      { ...baseService, id: 'c', runStatus: 'error' },
    ])
    expect(summary.status).toBe('error')
    expect(summary.error).toBe(1)
  })

  it('should count stopping as transitional', () => {
    const summary = getStackRunSummary([{ ...baseService, runStatus: 'stopping' }])
    expect(summary.status).toBe('transitional')
    expect(summary.transitional).toBe(1)
  })
})

describe('getStackStatusPaletteKey', () => {
  it('should map statuses to palette keys', () => {
    expect(getStackStatusPaletteKey('error')).toBe('error')
    expect(getStackStatusPaletteKey('transitional')).toBe('warning')
    expect(getStackStatusPaletteKey('running')).toBe('success')
    expect(getStackStatusPaletteKey('stopped')).toBe('secondary')
    expect(getStackStatusPaletteKey('empty')).toBe('secondary')
  })
})

describe('formatStackRunSummaryTooltip', () => {
  it('should describe transitional counts in the tooltip', () => {
    const summary = getStackRunSummary([
      { ...baseService, id: 'a', runStatus: 'running' },
      { ...baseService, id: 'b', runStatus: 'starting' },
      { ...baseService, id: 'c', runStatus: 'stopped' },
    ])

    expect(formatStackRunSummaryTooltip(summary)).toBe('1 running, 1 starting/stopping, 1 stopped')
  })
})
