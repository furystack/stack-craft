import type { WithOptionalId } from '@furystack/core'
import type { DeleteEndpoint, GetCollectionEndpoint, GetEntityEndpoint, PatchEndpoint, RestApi } from '@furystack/rest'
import type { Dependency } from '../models/dependency.js'
import type { GitHubRepository } from '../models/github-repository.js'
import type { ServiceConfig } from '../models/service-config.js'
import type { ServiceDefinition } from '../models/service-definition.js'
import type { StackConfig } from '../models/stack-config.js'
import type { StackDefinition } from '../models/stack-definition.js'
import type { StackView } from '../models/views.js'

export type StackWritableFields = Omit<StackDefinition, 'createdAt' | 'updatedAt'> &
  Omit<StackConfig, 'createdAt' | 'updatedAt' | 'stackName'>
export type PostStackEndpoint = { result: StackView; body: WithOptionalId<StackWritableFields, 'name'> }
export type PatchStackEndpoint = PatchEndpoint<StackWritableFields, 'name'>

type ShareableStackDefinition = Omit<StackDefinition, 'createdAt' | 'updatedAt'>
type ShareableServiceDefinition = Omit<ServiceDefinition, 'createdAt' | 'updatedAt'>
type ShareableGitHubRepository = Omit<GitHubRepository, 'createdAt' | 'updatedAt'>
type ShareableDependency = Omit<Dependency, 'createdAt' | 'updatedAt'>

export type ExportStackEndpoint = {
  url: { id: string }
  result: {
    stack: ShareableStackDefinition
    services: ShareableServiceDefinition[]
    repositories: ShareableGitHubRepository[]
    dependencies: ShareableDependency[]
  }
}

export type ImportStackEndpoint = {
  result: { success: boolean }
  body: {
    stack: ShareableStackDefinition
    services: ShareableServiceDefinition[]
    repositories: ShareableGitHubRepository[]
    dependencies: ShareableDependency[]
    config: {
      mainDirectory: string
      services?: Record<
        string,
        Partial<Pick<ServiceConfig, 'autoFetchEnabled' | 'autoFetchIntervalMinutes' | 'autoRestartOnFetch'>>
      >
    }
  }
}

export type StackSetupEndpoint = {
  url: { id: string }
  result: { success: boolean }
}

export interface StacksApi extends RestApi {
  GET: {
    '/stacks': GetCollectionEndpoint<StackView>
    '/stacks/:id': GetEntityEndpoint<StackView, 'name'>
    '/stacks/:id/export': ExportStackEndpoint
  }
  POST: {
    '/stacks': PostStackEndpoint
    '/stacks/import': ImportStackEndpoint
    '/stacks/:id/setup': StackSetupEndpoint
  }
  PATCH: {
    '/stacks/:id': PatchStackEndpoint
  }
  DELETE: {
    '/stacks/:id': DeleteEndpoint<StackDefinition, 'name'>
  }
}
