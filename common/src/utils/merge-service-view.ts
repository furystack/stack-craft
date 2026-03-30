import type { ServiceConfig } from '../models/service-config.js'
import type { ServiceDefinition } from '../models/service-definition.js'
import type { ServiceGitStatus } from '../models/service-git-status.js'
import type { ServiceStatus } from '../models/service-status.js'
import type { ServiceView } from '../models/views.js'

export const mergeServiceView = (
  def: ServiceDefinition,
  config?: ServiceConfig,
  status?: ServiceStatus,
  gitStatus?: ServiceGitStatus,
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
  ...def,
  ...(config ?? {}),
  ...(status ?? {}),
  ...(gitStatus ?? {}),
})
