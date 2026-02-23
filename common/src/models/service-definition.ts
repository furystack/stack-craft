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

  /** IDs of {@link Prerequisite} entities required by this service */
  prerequisiteIds: string[] = []

  /** IDs of other {@link ServiceDefinition} entities that must be running first */
  prerequisiteServiceIds: string[] = []

  /** Shell command to install dependencies (e.g. "npm install") */
  installCommand?: string

  /** Shell command to build the service (e.g. "npm run build") */
  buildCommand?: string

  /** Shell command to run the service (e.g. "npm start") */
  runCommand!: string

  createdAt!: string
  updatedAt!: string
}
