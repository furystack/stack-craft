/**
 * REST API type definitions for stack management endpoints.
 * Stacks group related services, repositories, and prerequisites into a deployable unit.
 */

import type { WithOptionalId } from '@furystack/core'
import type { DeleteEndpoint, GetCollectionEndpoint, GetEntityEndpoint, PatchEndpoint, RestApi } from '@furystack/rest'
import type { EnvironmentVariableValue } from '../models/environment-variable-value.js'
import type { GitHubRepository } from '../models/github-repository.js'
import type { Prerequisite } from '../models/prerequisite.js'
import type { ServiceConfig } from '../models/service-config.js'
import type { ServiceFile } from '../models/service-definition.js'
import type { ServiceDefinition } from '../models/service-definition.js'
import type { StackConfig } from '../models/stack-config.js'
import type { StackDefinition } from '../models/stack-definition.js'
import type { StackView } from '../models/views.js'

export type StackWritableFields = Omit<StackDefinition, 'createdAt' | 'updatedAt'> &
  Omit<StackConfig, 'createdAt' | 'updatedAt' | 'stackName'>

/** Creates a new stack with optional configuration */
export type PostStackEndpoint = { result: StackView; body: WithOptionalId<StackWritableFields, 'name'> }

export type PatchStackEndpoint = PatchEndpoint<StackWritableFields, 'name'>

type ShareableStackDefinition = Omit<StackDefinition, 'createdAt' | 'updatedAt'>
type ShareableServiceDefinition = Omit<ServiceDefinition, 'createdAt' | 'updatedAt'> & {
  prerequisiteIds: string[]
  prerequisiteServiceIds: string[]
}
type ShareableGitHubRepository = Omit<GitHubRepository, 'createdAt' | 'updatedAt'>
type ShareablePrerequisite = Omit<Prerequisite, 'createdAt' | 'updatedAt'>

/** A warning about a potential secret detected during stack export */
export type SecretWarning = {
  line: number
  pattern: string
  snippet: string
  source: string
  suggestion?: string
}

/** Exports a stack and all its associated services, repositories, and prerequisites for sharing */
export type ExportStackEndpoint = {
  url: { id: string }
  result: {
    stack: ShareableStackDefinition
    services: ShareableServiceDefinition[]
    repositories: ShareableGitHubRepository[]
    prerequisites: ShareablePrerequisite[]
    warnings?: SecretWarning[]
  }
}

/** Imports a previously exported stack, creating all associated entities and applying configuration overrides */
export type ImportStackEndpoint = {
  result: { success: boolean; warnings?: SecretWarning[] }
  body: {
    stack: ShareableStackDefinition
    services: ShareableServiceDefinition[]
    repositories: ShareableGitHubRepository[]
    prerequisites: ShareablePrerequisite[]
    config: {
      mainDirectory: string
      environmentVariables?: Record<string, EnvironmentVariableValue>
      services?: Record<
        string,
        Partial<Pick<ServiceConfig, 'autoFetchEnabled' | 'autoFetchIntervalMinutes' | 'autoRestartOnFetch'>> & {
          environmentVariableOverrides?: Record<string, EnvironmentVariableValue>
          localFiles?: ServiceFile[]
        }
      >
    }
  }
}

/** Runs the setup pipeline (clone, install, build) for all services in a stack */
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
