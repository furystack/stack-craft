import type { WithOptionalId } from '@furystack/core'
import type { DeleteEndpoint, GetCollectionEndpoint, GetEntityEndpoint, PatchEndpoint, RestApi } from '@furystack/rest'
import type { Dependency } from '../models/dependency.js'

export type DependencyWritableFields = Omit<Dependency, 'createdAt' | 'updatedAt'>

export type PostDependencyEndpoint = {
  result: Dependency
  body: WithOptionalId<DependencyWritableFields, 'id'>
}

export type PatchDependencyEndpoint = PatchEndpoint<DependencyWritableFields, 'id'>

export type CheckDependencyEndpoint = {
  url: { id: string }
  result: { satisfied: boolean; output: string }
}

export interface DependenciesApi extends RestApi {
  GET: {
    '/dependencies': GetCollectionEndpoint<Dependency>
    '/dependencies/:id': GetEntityEndpoint<Dependency, 'id'>
  }
  POST: {
    '/dependencies': PostDependencyEndpoint
    '/dependencies/:id/check': CheckDependencyEndpoint
  }
  PATCH: {
    '/dependencies/:id': PatchDependencyEndpoint
  }
  DELETE: {
    '/dependencies/:id': DeleteEndpoint<Dependency, 'id'>
  }
}
