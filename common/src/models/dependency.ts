/**
 * Shareable dependency definition.
 * Describes an external prerequisite (e.g. Node.js, Docker) that services may require.
 * Included in stack exports and shared between installations.
 */
export class Dependency {
  /** UUID primary key */
  id!: string

  /** FK to {@link StackDefinition.name} */
  stackName!: string

  /** Human-readable dependency name (e.g. "Node.js") */
  name!: string

  /** Shell command to check if the dependency is satisfied (e.g. "node --version") */
  checkCommand!: string

  /** Help text shown when the dependency check fails */
  installationHelp: string = ''

  createdAt!: string
  updatedAt!: string
}
