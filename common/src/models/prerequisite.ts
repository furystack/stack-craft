/**
 * The type of prerequisite that must be satisfied before a stack or service can run.
 */
export type PrerequisiteType =
  | 'node'
  | 'yarn'
  | 'dotnet-sdk'
  | 'dotnet-runtime'
  | 'nuget-feed'
  | 'git'
  | 'github-cli'
  | 'env-variable'
  | 'custom-script'

/**
 * Maps each prerequisite type to its type-specific configuration shape.
 */
export type PrerequisiteConfigMap = {
  node: { minimumVersion: string }
  yarn: { minimumVersion: string }
  'dotnet-sdk': { version: string }
  'dotnet-runtime': { version: string }
  'nuget-feed': { feedUrl: string; feedName?: string }
  git: Record<string, never>
  'github-cli': Record<string, never>
  'env-variable': { variableName: string }
  'custom-script': { script: string }
}

/**
 * Union of all possible prerequisite config shapes.
 */
export type PrerequisiteConfig = PrerequisiteConfigMap[PrerequisiteType]

/**
 * Shareable prerequisite definition.
 * Describes an external requirement (e.g. Node.js, Git, an env variable)
 * that a stack or service may need to be satisfied before it can run.
 * Included in stack exports and shared between installations.
 */
export class Prerequisite {
  /** UUID primary key */
  id!: string

  /** FK to {@link StackDefinition.name} */
  stackName!: string

  /** Human-readable prerequisite name (e.g. "Node.js >= 18") */
  name!: string

  /** Discriminator that determines the check logic and config shape */
  type!: PrerequisiteType

  /** Type-specific configuration (stored as JSON TEXT in the database) */
  config!: PrerequisiteConfig

  /** Help text shown when the prerequisite check fails */
  installationHelp: string = ''

  createdAt!: string
  updatedAt!: string
}
