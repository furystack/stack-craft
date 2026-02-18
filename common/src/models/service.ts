export type InstallStatus = 'not-installed' | 'installing' | 'installed' | 'failed'
export type BuildStatus = 'not-built' | 'building' | 'built' | 'failed'
export type RunStatus = 'stopped' | 'starting' | 'running' | 'stopping' | 'error'

export class Service {
  id!: string
  stackName!: string
  displayName!: string
  description: string = ''
  workingDirectory?: string
  repositoryId?: string

  autoFetchEnabled: boolean = false
  autoFetchIntervalMinutes: number = 60
  lastFetchedAt?: string
  autoRestartOnFetch: boolean = false

  dependencyIds: string[] = []
  prerequisiteServiceIds: string[] = []

  installCommand?: string
  buildCommand?: string
  runCommand!: string

  installStatus: InstallStatus = 'not-installed'
  buildStatus: BuildStatus = 'not-built'
  runStatus: RunStatus = 'stopped'

  lastInstalledAt?: string
  lastBuiltAt?: string
  lastStartedAt?: string
  createdAt!: string
  updatedAt!: string
}
