import type { StackConfig } from './stack-config.js'
import type { StackDefinition } from './stack-definition.js'
import type { ServiceConfig } from './service-config.js'
import type { ServiceDefinition } from './service-definition.js'
import type { ServiceGitStatus } from './service-git-status.js'
import type { ServiceStatus } from './service-status.js'

/** Full stack view combining definition and config for API responses */
export type StackView = StackDefinition & StackConfig

/** Full service view combining definition, config, status, and git state for API responses */
export type ServiceView = ServiceDefinition & ServiceConfig & ServiceStatus & ServiceGitStatus
