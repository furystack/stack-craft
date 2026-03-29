/**
 * In-memory git state for a service.
 * Derived from the filesystem (`.git/HEAD`), never persisted to DB.
 * @see ServiceStatus for the persisted runtime status
 */
export class ServiceGitStatus {
  /** FK to {@link import('./service-definition.js').ServiceDefinition.id} */
  serviceId!: string

  currentBranch?: string
}
