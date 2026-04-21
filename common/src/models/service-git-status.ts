/** Upstream branch presence on the remote. Used to detect branches that were deleted from origin. */
export type UpstreamStatus = 'present' | 'gone' | 'unknown'

/** State of the local working tree relative to HEAD. */
export type WorktreeStatus = 'clean' | 'dirty' | 'conflicts' | 'unknown'

/** Persisted-per-session flags for warnings the user has dismissed. Reset on service restart. */
export type ServiceGitWarningDismissals = {
  upstreamGone?: boolean
  stale?: boolean
}

/**
 * In-memory git state for a service.
 * Derived from the filesystem (`.git/HEAD`, `.git/refs/heads/`) and periodic remote checks, never persisted to DB.
 * @see ServiceStatus for the persisted runtime status
 */
export class ServiceGitStatus {
  /** FK to {@link import('./service-definition.js').ServiceDefinition.id} */
  serviceId!: string

  currentBranch?: string

  /** Number of commits the local branch is behind `origin/<currentBranch>`. Updated by GitWatcher after each fetch. */
  commitsBehind?: number

  /** Whether the upstream branch (`origin/<currentBranch>`) still exists on the remote. */
  upstreamStatus?: UpstreamStatus

  /** State of the local working tree (clean/dirty/conflicts). Derived from `git status --porcelain`. */
  worktreeStatus?: WorktreeStatus

  /** Last error message produced by a pull attempt on an already-cloned repository. Cleared on successful pull. */
  lastPullError?: string

  /** Warnings the user has dismissed for this session. */
  warningsDismissed?: ServiceGitWarningDismissals
}
