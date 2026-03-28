/**
 * Shareable stack definition.
 * Contains the immutable identity and description of a stack.
 * Included in stack exports and shared between installations.
 * @see StackConfig for user-specific configuration
 */
export class StackDefinition {
  /** Unique kebab-case identifier for the stack */
  name!: string

  /** Human-readable name shown in the UI */
  displayName!: string

  /** Optional description of what this stack does */
  description: string = ''

  createdAt!: string
  updatedAt!: string
}
