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
import type { ServiceDefinition, ServiceFile } from '../models/service-definition.js'
import type { StackConfig } from '../models/stack-config.js'
import type { StackDefinition } from '../models/stack-definition.js'
import type { StackView } from '../models/views.js'

export type StackWritableFields = Omit<StackDefinition, 'createdAt' | 'updatedAt'> &
  Omit<StackConfig, 'createdAt' | 'updatedAt' | 'stackName'>

/** Creates a new stack with optional configuration */
export type PostStackEndpoint = { result: StackView; body: WithOptionalId<StackWritableFields, 'name'> }

export type PatchStackEndpoint = PatchEndpoint<StackWritableFields, 'name'>

type ShareableStackDefinition = Omit<StackDefinition, 'createdAt' | 'updatedAt'>
/**
 * Child entities omit `stackName` from the wire format — it is always equal to the top-level
 * `stack.name` and is reattached at import time. Keeping it on the wire bloated every export
 * by N+M+P repetitions of the same string with no informational value.
 */
type ShareableServiceDefinition = Omit<ServiceDefinition, 'createdAt' | 'updatedAt' | 'stackName'> & {
  prerequisiteIds: string[]
  prerequisiteServiceIds: string[]
}
type ShareableGitHubRepository = Omit<GitHubRepository, 'createdAt' | 'updatedAt' | 'stackName'>
type ShareablePrerequisite = Omit<Prerequisite, 'createdAt' | 'updatedAt' | 'stackName'>

/** A warning about a potential secret detected during stack export */
export type SecretWarning = {
  line: number
  pattern: string
  snippet: string
  source: string
  suggestion?: string
}

export type ExportStackResult = {
  stack: ShareableStackDefinition
  services: ShareableServiceDefinition[]
  repositories: ShareableGitHubRepository[]
  prerequisites: ShareablePrerequisite[]
  warnings?: SecretWarning[]
}

/** Exports a stack and all its associated services, repositories, and prerequisites for sharing */
export type ExportStackEndpoint = {
  url: { id: string }
  result: ExportStackResult
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
    /**
     * When true, the server assigns fresh UUIDs to every service, repository, and prerequisite
     * before insertion. Use this to duplicate an existing stack on the same machine — set a new
     * stack name and enable this flag so the entity IDs do not collide with the source stack.
     * Inter-entity references (`prerequisiteIds`, `prerequisiteServiceIds`, and the
     * `config.services` map) are remapped to the new IDs.
     */
    regenerateIds?: boolean
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
