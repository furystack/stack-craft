import type { StackConfig } from './stack-config.js'
import type { StackDefinition } from './stack-definition.js'
import type { ServiceConfig } from './service-config.js'
import type { ServiceDefinition } from './service-definition.js'
import type { ServiceGitStatus } from './service-git-status.js'
import type { ServiceStatus } from './service-status.js'

/** Full stack view combining definition and config for API responses */
export type StackView = StackDefinition & StackConfig

/** Prerequisite and dependency relationships resolved from join tables */
export type ServiceRelations = {
  prerequisiteIds: string[]
  prerequisiteServiceIds: string[]
}

/** Full service view combining definition, config, status, git state, and relations for API responses */
export type ServiceView = ServiceDefinition & ServiceConfig & ServiceStatus & ServiceGitStatus & ServiceRelations
