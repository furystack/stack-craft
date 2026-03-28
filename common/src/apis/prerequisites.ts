import type { WithOptionalId } from '@furystack/core'
import type { DeleteEndpoint, GetCollectionEndpoint, GetEntityEndpoint, PatchEndpoint, RestApi } from '@furystack/rest'
import type { Prerequisite } from '../models/prerequisite.js'

export type PrerequisiteWritableFields = Omit<Prerequisite, 'createdAt' | 'updatedAt'>

export type PostPrerequisiteEndpoint = {
  result: Prerequisite
  body: WithOptionalId<PrerequisiteWritableFields, 'id'>
}

export type PatchPrerequisiteEndpoint = PatchEndpoint<PrerequisiteWritableFields, 'id'>

export type CheckPrerequisiteEndpoint = {
  url: { id: string }
  result: { satisfied: boolean; output: string }
}

export interface PrerequisitesApi extends RestApi {
  GET: {
    '/prerequisites': GetCollectionEndpoint<Prerequisite>
    '/prerequisites/:id': GetEntityEndpoint<Prerequisite, 'id'>
  }
  POST: {
    '/prerequisites': PostPrerequisiteEndpoint
    '/prerequisites/:id/check': CheckPrerequisiteEndpoint
  }
  PATCH: {
    '/prerequisites/:id': PatchPrerequisiteEndpoint
  }
  DELETE: {
    '/prerequisites/:id': DeleteEndpoint<Prerequisite, 'id'>
  }
}
