export type CloneStatus = 'not-cloned' | 'cloning' | 'cloned' | 'failed'
export type InstallStatus = 'not-installed' | 'installing' | 'installed' | 'failed'
export type BuildStatus = 'not-built' | 'building' | 'built' | 'failed'
export type RunStatus = 'stopped' | 'starting' | 'running' | 'stopping' | 'error'

/**
 * Runtime status of a service.
 * Managed by the system (ProcessManager, GitWatcher).
 * Never exported. Reset to defaults on import.
 * @see ServiceDefinition for the shareable definition
 * @see ServiceStateHistory for the audit log of state transitions
 */
export class ServiceStatus {
  /** FK to {@link ServiceDefinition.id} */
  serviceId!: string

  cloneStatus: CloneStatus = 'not-cloned'
  installStatus: InstallStatus = 'not-installed'
  buildStatus: BuildStatus = 'not-built'
  runStatus: RunStatus = 'stopped'

  currentBranch?: string

  lastClonedAt?: string
  lastInstalledAt?: string
  lastBuiltAt?: string
  lastStartedAt?: string
  lastFetchedAt?: string

  updatedAt!: string
}
