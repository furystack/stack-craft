import type { ServiceConfig } from '../models/service-config.js'
import type { ServiceDefinition } from '../models/service-definition.js'
import type { ServiceGitStatus } from '../models/service-git-status.js'
import type { ServiceStatus } from '../models/service-status.js'
import type { ServiceRelations, ServiceView } from '../models/views.js'

export const mergeServiceView = (
  def: ServiceDefinition,
  config?: ServiceConfig,
  status?: ServiceStatus,
  gitStatus?: ServiceGitStatus,
  relations?: ServiceRelations,
): ServiceView => ({
  serviceId: def.id,
  autoFetchEnabled: false,
  autoFetchIntervalMinutes: 60,
  autoRestartOnFetch: false,
  environmentVariableOverrides: {},
  localFiles: [],
  cloneStatus: 'not-cloned',
  installStatus: 'not-installed',
  buildStatus: 'not-built',
  runStatus: 'stopped',
  prerequisiteIds: [],
  prerequisiteServiceIds: [],
  ...def,
  ...(config ?? {}),
  ...(status ?? {}),
  ...(gitStatus ?? {}),
  ...(relations ?? {}),
})
