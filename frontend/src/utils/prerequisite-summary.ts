import type { PrerequisiteCheckResult, PrerequisiteCheckStatus } from 'common'

export type PrerequisiteSummary = {
  satisfiedCount: number
  failedCount: number
  total: number
}

export const getPrerequisiteSummary = (
  prereqIds: string[],
  checkResultMap: Map<string, PrerequisiteCheckResult>,
): PrerequisiteSummary | null => {
  if (prereqIds.length === 0) return null

  const statuses = prereqIds.map((id): PrerequisiteCheckStatus => checkResultMap.get(id)?.status ?? 'unchecked')
  const satisfiedCount = statuses.filter((s) => s === 'satisfied').length
  const failedCount = statuses.filter((s) => s === 'failed').length

  return { satisfiedCount, failedCount, total: prereqIds.length }
}
