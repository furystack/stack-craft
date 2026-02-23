/**
 * Possible statuses for a prerequisite check.
 */
export type PrerequisiteCheckStatus = 'unchecked' | 'checking' | 'satisfied' | 'failed'

/**
 * Represents the result of evaluating a {@link Prerequisite}.
 * Stored in an in-memory store on the service and synced to the frontend
 * via entity sync so that every connected client sees real-time status.
 */
export class PrerequisiteCheckResult {
  /** PK – corresponds to {@link Prerequisite.id} */
  prerequisiteId!: string

  /** Current check status */
  status!: PrerequisiteCheckStatus

  /** Human-readable output from the last check */
  output: string = ''

  /** ISO-8601 timestamp of the last check */
  checkedAt: string = ''
}
