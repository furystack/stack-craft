import type { WithOptionalId } from '@furystack/core'
import type { DeleteEndpoint, GetCollectionEndpoint, GetEntityEndpoint, PatchEndpoint, RestApi } from '@furystack/rest'
import type { ServiceConfig } from '../models/service-config.js'
import type { ServiceDefinition } from '../models/service-definition.js'
import type { ServiceLogEntry } from '../models/service-log-entry.js'
import type { ServiceStateHistory } from '../models/service-state-history.js'
import type { ServiceView } from '../models/views.js'

export type ServiceDefinitionWritableFields = Omit<ServiceDefinition, 'createdAt' | 'updatedAt'>
export type ServiceConfigWritableFields = Omit<ServiceConfig, 'createdAt' | 'updatedAt'>
export type ServiceWritableFields = ServiceDefinitionWritableFields & Omit<ServiceConfigWritableFields, 'serviceId'>

export type PostServiceEndpoint = {
  result: ServiceView
  body: WithOptionalId<ServiceWritableFields, 'id'>
}

export type PatchServiceEndpoint = PatchEndpoint<ServiceWritableFields, 'id'>

export type ServiceActionEndpoint = { url: { id: string }; result: { success: boolean; serviceId: string } }

export type ServiceLogsEndpoint = {
  url: { id: string }
  query: { lines?: number; processUid?: string; search?: string }
  result: { entries: ServiceLogEntry[] }
}

export type ClearServiceLogsEndpoint = {
  url: { id: string }
  result: { success: boolean }
}

export type ServiceHistoryEndpoint = {
  url: { id: string }
  query: { limit?: number }
  result: { entries: ServiceStateHistory[] }
}

export interface ServicesApi extends RestApi {
  GET: {
    '/services': GetCollectionEndpoint<ServiceView>
    '/services/:id': GetEntityEndpoint<ServiceView, 'id'>
    '/services/:id/logs': ServiceLogsEndpoint
    '/services/:id/history': ServiceHistoryEndpoint
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
  }
  PATCH: {
    '/services/:id': PatchServiceEndpoint
  }
  DELETE: {
    '/services/:id': DeleteEndpoint<ServiceDefinition, 'id'>
    '/services/:id/logs': ClearServiceLogsEndpoint
  }
}
