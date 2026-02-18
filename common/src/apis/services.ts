import type { WithOptionalId } from '@furystack/core'
import type {
  DeleteEndpoint,
  GetCollectionEndpoint,
  GetEntityEndpoint,
  PatchEndpoint,
  RestApi,
} from '@furystack/rest'
import type { Service } from '../models/service.js'

export type ServiceWritableFields = Omit<
  Service,
  'installStatus' | 'buildStatus' | 'runStatus' | 'lastInstalledAt' | 'lastBuiltAt' | 'lastStartedAt' | 'lastFetchedAt' | 'createdAt' | 'updatedAt'
>

export type PostServiceEndpoint = {
  result: Service
  body: WithOptionalId<ServiceWritableFields, 'id'>
}

export type PatchServiceEndpoint = PatchEndpoint<ServiceWritableFields, 'id'>

export type ServiceActionEndpoint = { url: { id: string }; result: { success: boolean; serviceId: string } }

export type ServiceLogsEndpoint = {
  url: { id: string }
  query: { lines?: number }
  result: { lines: string[] }
}

export interface ServicesApi extends RestApi {
  GET: {
    '/services': GetCollectionEndpoint<Service>
    '/services/:id': GetEntityEndpoint<Service, 'id'>
    '/services/:id/logs': ServiceLogsEndpoint
  }
  POST: {
    '/services': PostServiceEndpoint
    '/services/:id/start': ServiceActionEndpoint
    '/services/:id/stop': ServiceActionEndpoint
    '/services/:id/restart': ServiceActionEndpoint
    '/services/:id/install': ServiceActionEndpoint
    '/services/:id/build': ServiceActionEndpoint
    '/services/:id/pull': ServiceActionEndpoint
  }
  PATCH: {
    '/services/:id': PatchServiceEndpoint
  }
  DELETE: {
    '/services/:id': DeleteEndpoint<Service, 'id'>
  }
}
