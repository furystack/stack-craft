/** Join table linking a {@link ServiceDefinition} to a {@link Prerequisite} */
export class ServicePrerequisiteLink {
  /** Deterministic PK: `${serviceId}::${prerequisiteId}` */
  id!: string

  /** FK to {@link ServiceDefinition.id} */
  serviceId!: string

  /** FK to {@link Prerequisite.id} */
  prerequisiteId!: string
}
