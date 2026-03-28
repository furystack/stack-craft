import type { EnvironmentVariableValue } from './environment-variable-value.js'

/**
 * User-specific service configuration.
 * Contains settings that each installation can customize independently.
 * Not included in exports - set by the user during import/installation.
 * @see ServiceDefinition for the shareable definition
 */
export class ServiceConfig {
  /** FK to {@link ServiceDefinition.id} */
  serviceId!: string

  /** Whether automatic git fetch is enabled */
  autoFetchEnabled: boolean = false

  /** Interval in minutes between automatic git fetches */
  autoFetchIntervalMinutes: number = 60

  /** Whether to automatically restart the service when new commits are fetched */
  autoRestartOnFetch: boolean = false

  /** Per-service environment variable overrides, keyed by variable name. Overrides stack-level defaults. */
  environmentVariableOverrides: Record<string, EnvironmentVariableValue> = {}

  createdAt!: string
  updatedAt!: string
}
