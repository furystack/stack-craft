/** Join table linking a {@link ServiceDefinition} to another service it depends on */
export class ServiceDependencyLink {
  /** Deterministic PK: `${serviceId}::${dependsOnServiceId}` */
  id!: string

  /** FK to {@link ServiceDefinition.id} -- the dependent service */
  serviceId!: string

  /** FK to {@link ServiceDefinition.id} -- the service that must run first */
  dependsOnServiceId!: string
}
