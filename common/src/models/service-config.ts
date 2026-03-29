import type { EnvironmentVariableValue } from './environment-variable-value.js'
import type { ServiceFile } from './service-definition.js'

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

  /**
   * Per-installation secret files, encrypted at rest. NOT included in exports.
   * When a local file shares a `relativePath` with a shared file from
   * {@link ServiceDefinition.files}, the local file takes precedence at apply time.
   */
  localFiles: ServiceFile[] = []

  createdAt!: string
  updatedAt!: string
}
