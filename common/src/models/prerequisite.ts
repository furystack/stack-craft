/**
 * Prerequisite configuration for NodeJs
 */
export type NodePrerequisiteConfig = { minimumVersion: string }

/**
 * Prerequisite configuration type for Yarn package manager
 */
export type YarnPrerequisiteConfig = { minimumVersion: string }

/**
 * Prerequisite config for Dotnet SDK
 */
export type DotnetSdkPrerequisiteConfig = { version: string }

/**
 * Prerequisite config for Dotnet Runtime
 */
export type DotnetRuntimePrerequisiteConfig = { version: string }

/**
 * Prerequisite config for NuGet feeds
 */
export type NugetFeedPrerequisiteConfig = { feedUrl: string; feedName?: string }

/**
 * Prerequisite config for GIT
 */
export type GitPrerequisiteConfig = Record<string, any>

/**
 * Prerequisite config for Github CLI
 */
export type GithubCliPrerequisiteConfig = Record<string, any>

/**
 * Prerequisite config for an environment variable
 */
export type EnvVariablePrerequisiteConfig = { variableName: string; isSensitive?: boolean }

/**
 * Prerequisite type for executing a custom script
 */
export type CustomScriptPrerequisiteConfig = { script: string }

/**
 * Maps each prerequisite type to its type-specific configuration shape.
 */
export type PrerequisiteConfigMap = {
  node: NodePrerequisiteConfig
  yarn: YarnPrerequisiteConfig
  'dotnet-sdk': DotnetSdkPrerequisiteConfig
  'dotnet-runtime': DotnetRuntimePrerequisiteConfig
  'nuget-feed': NugetFeedPrerequisiteConfig
  git: GitPrerequisiteConfig
  'github-cli': GithubCliPrerequisiteConfig
  'env-variable': EnvVariablePrerequisiteConfig
  'custom-script': CustomScriptPrerequisiteConfig
}

/**
 * The type of prerequisite that must be satisfied before a stack or service can run.
 */
export type PrerequisiteType = keyof PrerequisiteConfigMap

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
