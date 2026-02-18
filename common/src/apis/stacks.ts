import type { WithOptionalId } from '@furystack/core'
import type { DeleteEndpoint, GetCollectionEndpoint, GetEntityEndpoint, PatchEndpoint, RestApi } from '@furystack/rest'
import type { Dependency } from '../models/dependency.js'
import type { GitHubRepository } from '../models/github-repository.js'
import type { Service } from '../models/service.js'
import type { Stack } from '../models/stack.js'

export type StackWritableFields = Omit<Stack, 'createdAt' | 'updatedAt'>
export type PostStackEndpoint = { result: Stack; body: WithOptionalId<Stack, 'name'> }
export type PatchStackEndpoint = PatchEndpoint<StackWritableFields, 'name'>

export type ExportStackEndpoint = {
  url: { id: string }
  result: { stack: Stack; services: Service[]; repositories: GitHubRepository[]; dependencies: Dependency[] }
}

export type ImportStackEndpoint = {
  result: { success: boolean }
  body: { stack: Stack; services: Service[]; repositories: GitHubRepository[]; dependencies: Dependency[] }
}

export interface StacksApi extends RestApi {
  GET: {
    '/stacks': GetCollectionEndpoint<Stack>
    '/stacks/:id': GetEntityEndpoint<Stack, 'name'>
    '/stacks/:id/export': ExportStackEndpoint
  }
  POST: {
    '/stacks': PostStackEndpoint
    '/stacks/import': ImportStackEndpoint
  }
  PATCH: {
    '/stacks/:id': PatchStackEndpoint
  }
  DELETE: {
    '/stacks/:id': DeleteEndpoint<Stack, 'name'>
  }
}
