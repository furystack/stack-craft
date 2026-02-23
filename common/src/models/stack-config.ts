import type { EnvironmentVariableValue } from './environment-variable-value.js'

/**
 * User-specific stack configuration.
 * Contains settings unique to this installation/machine.
 * Not included in exports - set by the user during import/installation.
 * @see StackDefinition for the shareable definition
 */
export class StackConfig {
  /** FK to {@link StackDefinition.name} */
  stackName!: string

  /** Absolute path to the root directory for all services in this stack */
  mainDirectory!: string

  /** Stack-level environment variable values, keyed by variable name */
  environmentVariables: Record<string, EnvironmentVariableValue> = {}

  createdAt!: string
  updatedAt!: string
}
