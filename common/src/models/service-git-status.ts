/**
 * In-memory git state for a service.
 * Derived from the filesystem (`.git/HEAD`) and periodic remote checks, never persisted to DB.
 * @see ServiceStatus for the persisted runtime status
 */
export class ServiceGitStatus {
  /** FK to {@link import('./service-definition.js').ServiceDefinition.id} */
  serviceId!: string

  currentBranch?: string

  /** Number of commits the local branch is behind `origin/<currentBranch>`. Updated by GitWatcher after each fetch. */
  commitsBehind?: number
}
