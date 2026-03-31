import { describe, expect, it } from 'vitest'

import type { PrerequisiteCheckResult } from 'common'

import { getPrerequisiteSummary } from './prerequisite-summary.js'

const makeCheckResult = (
  prerequisiteId: string,
  status: PrerequisiteCheckResult['status'],
): PrerequisiteCheckResult => ({
  prerequisiteId,
  status,
  output: '',
  checkedAt: '',
})

describe('getPrerequisiteSummary', () => {
  it('should return null for empty prereqIds', () => {
    const result = getPrerequisiteSummary([], new Map())
    expect(result).toBeNull()
  })

  it('should return all satisfied when every prereq is satisfied', () => {
    const map = new Map<string, PrerequisiteCheckResult>([
      ['p1', makeCheckResult('p1', 'satisfied')],
      ['p2', makeCheckResult('p2', 'satisfied')],
    ])
    const result = getPrerequisiteSummary(['p1', 'p2'], map)
    expect(result).toEqual({ satisfiedCount: 2, failedCount: 0, total: 2 })
  })

  it('should count failed prerequisites', () => {
    const map = new Map<string, PrerequisiteCheckResult>([
      ['p1', makeCheckResult('p1', 'satisfied')],
      ['p2', makeCheckResult('p2', 'failed')],
      ['p3', makeCheckResult('p3', 'failed')],
    ])
    const result = getPrerequisiteSummary(['p1', 'p2', 'p3'], map)
    expect(result).toEqual({ satisfiedCount: 1, failedCount: 2, total: 3 })
  })

  it('should treat missing map entries as unchecked (neither satisfied nor failed)', () => {
    const map = new Map<string, PrerequisiteCheckResult>([['p1', makeCheckResult('p1', 'satisfied')]])
    const result = getPrerequisiteSummary(['p1', 'p2'], map)
    expect(result).toEqual({ satisfiedCount: 1, failedCount: 0, total: 2 })
  })

  it('should treat "checking" and "unchecked" statuses as neither satisfied nor failed', () => {
    const map = new Map<string, PrerequisiteCheckResult>([
      ['p1', makeCheckResult('p1', 'checking')],
      ['p2', makeCheckResult('p2', 'unchecked')],
      ['p3', makeCheckResult('p3', 'satisfied')],
    ])
    const result = getPrerequisiteSummary(['p1', 'p2', 'p3'], map)
    expect(result).toEqual({ satisfiedCount: 1, failedCount: 0, total: 3 })
  })

  it('should handle a mix of all statuses', () => {
    const map = new Map<string, PrerequisiteCheckResult>([
      ['p1', makeCheckResult('p1', 'satisfied')],
      ['p2', makeCheckResult('p2', 'failed')],
      ['p3', makeCheckResult('p3', 'checking')],
      ['p4', makeCheckResult('p4', 'unchecked')],
    ])
    const result = getPrerequisiteSummary(['p1', 'p2', 'p3', 'p4', 'p5'], map)
    expect(result).toEqual({ satisfiedCount: 1, failedCount: 1, total: 5 })
  })
})
