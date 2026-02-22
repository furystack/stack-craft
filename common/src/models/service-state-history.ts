/**
 * Event types for service state transitions.
 * Each value represents a discrete lifecycle event that can occur.
 */
export type ServiceStateEvent =
  | 'clone-started'
  | 'clone-completed'
  | 'clone-failed'
  | 'run-started'
  | 'run-stopped'
  | 'run-crashed'
  | 'run-restarted'
  | 'install-started'
  | 'install-completed'
  | 'install-failed'
  | 'build-started'
  | 'build-completed'
  | 'build-failed'
  | 'setup-started'
  | 'setup-completed'
  | 'setup-failed'
  | 'update-started'
  | 'update-completed'
  | 'update-failed'
  | 'pull-completed'
  | 'imported'
  | 'state-reconciled'

/**
 * How a state change was triggered.
 * Used to distinguish user actions from automated system behavior.
 */
export type TriggerSource = 'api' | 'mcp' | 'auto-fetch' | 'auto-restart' | 'system'

/**
 * Audit log entry for service state transitions.
 * Records every lifecycle event (start, stop, crash, install, build, pull)
 * with full context: who triggered it, how, and any relevant metadata.
 * Entries are never deleted and not included in exports.
 */
export class ServiceStateHistory {
  /** Auto-increment primary key */
  id!: number

  /** FK to {@link ServiceDefinition.id} */
  serviceId!: string

  /** The lifecycle event that occurred */
  event!: ServiceStateEvent

  /** JSON snapshot of relevant status fields before the change */
  previousState?: string

  /** JSON snapshot of relevant status fields after the change */
  newState?: string

  /** Username of the user who triggered the action, or 'system' */
  triggeredBy!: string

  /** How the action was triggered */
  triggerSource!: TriggerSource

  /** Optional JSON with extra context (exit code, error message, etc.) */
  metadata?: string

  /** UUID of the associated process, if this event produced log output */
  processUid?: string

  createdAt!: string
}
