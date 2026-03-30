/** A file to be placed relative to the service root (e.g. .env, appConfig.local.json) */
export type ServiceFile = {
  /** Path relative to the service working directory */
  relativePath: string
  /** File content (usually plain text) */
  content: string
}

/**
 * Shareable service definition.
 * Contains the immutable description of a service and its commands.
 * Included in stack exports and shared between installations.
 * @see ServiceConfig for user-specific configuration
 * @see ServiceStatus for runtime state
 */
export class ServiceDefinition {
  /** UUID primary key */
  id!: string

  /** FK to {@link StackDefinition.name} */
  stackName!: string

  /** Human-readable name shown in the UI */
  displayName!: string

  /** Optional description of what this service does */
  description: string = ''

  /** Optional relative path within stack for grouping (e.g. "frontends/public") */
  workingDirectory?: string

  /** Optional FK to {@link GitHubRepository.id} */
  repositoryId?: string

  /** Shell command to install dependencies (e.g. "npm install") */
  installCommand?: string

  /** Shell command to build the service (e.g. "npm run build") */
  buildCommand?: string

  /** Shell command to run the service (e.g. "npm start") */
  runCommand!: string

  /** Shared files placed relative to the service root */
  files: ServiceFile[] = []

  createdAt!: string
  updatedAt!: string
}
