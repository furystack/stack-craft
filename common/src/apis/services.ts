import type { WithOptionalId } from '@furystack/core'
import type { DeleteEndpoint, GetCollectionEndpoint, GetEntityEndpoint, PatchEndpoint, RestApi } from '@furystack/rest'
import type { ServiceConfig } from '../models/service-config.js'
import type { ServiceDefinition } from '../models/service-definition.js'
import type { ServiceLogEntry } from '../models/service-log-entry.js'
import type { ServiceStateHistory } from '../models/service-state-history.js'
import type { ServiceView } from '../models/views.js'

export type ServiceDefinitionWritableFields = Omit<ServiceDefinition, 'createdAt' | 'updatedAt'>
export type ServiceConfigWritableFields = Omit<ServiceConfig, 'createdAt' | 'updatedAt'>
export type ServiceWritableFields = ServiceDefinitionWritableFields &
  Omit<ServiceConfigWritableFields, 'serviceId'> & {
    prerequisiteIds?: string[]
    prerequisiteServiceIds?: string[]
  }

/** Creates a new service definition with optional configuration */
export type PostServiceEndpoint = {
  result: ServiceView
  body: WithOptionalId<ServiceWritableFields, 'id'>
}

export type PatchServiceEndpoint = PatchEndpoint<ServiceWritableFields, 'id'>

/** Triggers a lifecycle action (start, stop, restart, install, build, pull, setup, update) on a service */
export type ServiceActionEndpoint = { url: { id: string }; result: { success: boolean; serviceId: string } }

/** Writes shared and local service files to disk, optionally for a single file */
export type ApplyServiceFilesEndpoint = {
  url: { id: string }
  body: { relativePath?: string }
  result: { success: boolean; serviceId: string; applied: string[] }
}

/** Retrieves recent log entries for a service, optionally filtered by process UID or search text */
export type ServiceLogsEndpoint = {
  url: { id: string }
  query: { lines?: number; processUid?: string; search?: string }
  result: { entries: ServiceLogEntry[] }
}

/** Deletes all stored log entries for a service */
export type ClearServiceLogsEndpoint = {
  url: { id: string }
  result: { success: boolean }
}

/** Retrieves the state transition history for a service */
export type ServiceHistoryEndpoint = {
  url: { id: string }
  query: { limit?: number }
  result: { entries: ServiceStateHistory[] }
}

/** Lists local and remote branches for the service's linked repository */
export type ServiceBranchesEndpoint = {
  url: { id: string }
  result: { currentBranch: string; local: string[]; remote: string[] }
}

/** Switches the service's repository to a different branch */
export type ServiceCheckoutEndpoint = {
  url: { id: string }
  body: { branch: string }
  result: { success: boolean; serviceId: string }
}

export interface ServicesApi extends RestApi {
  GET: {
    '/services': GetCollectionEndpoint<ServiceView>
    '/services/:id': GetEntityEndpoint<ServiceView, 'id'>
    '/services/:id/logs': ServiceLogsEndpoint
    '/services/:id/history': ServiceHistoryEndpoint
    '/services/:id/branches': ServiceBranchesEndpoint
  }
  POST: {
    '/services': PostServiceEndpoint
    '/services/:id/start': ServiceActionEndpoint
    '/services/:id/stop': ServiceActionEndpoint
    '/services/:id/restart': ServiceActionEndpoint
    '/services/:id/install': ServiceActionEndpoint
    '/services/:id/build': ServiceActionEndpoint
    '/services/:id/pull': ServiceActionEndpoint
    '/services/:id/setup': ServiceActionEndpoint
    '/services/:id/update': ServiceActionEndpoint
    '/services/:id/apply-files': ApplyServiceFilesEndpoint
    '/services/:id/checkout': ServiceCheckoutEndpoint
  }
  PATCH: {
    '/services/:id': PatchServiceEndpoint
  }
  DELETE: {
    '/services/:id': DeleteEndpoint<ServiceDefinition, 'id'>
    '/services/:id/logs': ClearServiceLogsEndpoint
  }
}
