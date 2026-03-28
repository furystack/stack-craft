/**
 * Shareable GitHub repository definition.
 * Links a git repository to a stack for cloning and pulling.
 * Included in stack exports and shared between installations.
 */
export class GitHubRepository {
  /** UUID primary key */
  id!: string

  /** FK to {@link StackDefinition.name} */
  stackName!: string

  /** Full URL to the git repository (e.g. "https://github.com/user/repo") */
  url!: string

  /** Human-readable name shown in the UI */
  displayName!: string

  /** Optional description */
  description: string = ''

  createdAt!: string
  updatedAt!: string
}
