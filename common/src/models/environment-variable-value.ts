/**
 * Describes how an environment variable's value is resolved.
 * Used in {@link StackConfig} for stack-level defaults and
 * in {@link ServiceConfig} for per-service overrides.
 */
export type EnvironmentVariableValue = {
  /** Whether to inherit the value from the host system or use a custom value */
  source: 'inherit' | 'custom'
  /** The custom value to use when source is 'custom' */
  customValue?: string
  /**
   * Whether this value contains sensitive data (e.g. passwords, tokens).
   * When true, the value is encrypted at rest and masked in API responses.
   * Overrides the prerequisite-level default when set.
   */
  isSensitive?: boolean
}
