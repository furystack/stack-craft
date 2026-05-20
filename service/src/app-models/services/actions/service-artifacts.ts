import type { PostServiceEndpoint, ServiceRelations } from 'common'
import { mergeServiceView, type ServiceConfig, type ServiceDefinition, type ServiceStatus } from 'common'
import { randomUUID } from 'crypto'

import { SENSITIVE_VALUE_MASK, type CryptoService } from '../../../utils/crypto-service.js'
import {
  encryptEnvValues,
  encryptLocalFiles,
  maskLocalFiles,
  maskSensitiveEnvValues,
} from '../../../utils/env-encryption-helpers.js'

/**
 * Materialised rows ready to be persisted for a new service, plus the
 * relational ids that drive link-row creation. Built once by
 * {@link buildServiceArtifacts} so the persistence and view-shaping helpers
 * share a single source of truth.
 */
export type ServiceArtifacts = {
  def: ServiceDefinition
  config: ServiceConfig
  status: ServiceStatus
  prerequisiteIds: string[]
  prerequisiteServiceIds: string[]
}

/**
 * Pure data assembly: turns a validated `POST /services` body into the four
 * concrete rows + relational ids that need to be persisted. Falls back to a
 * `randomUUID()` when the client omits `body.id`.
 */
export const buildServiceArtifacts = (
  body: PostServiceEndpoint['body'],
  crypto: CryptoService,
  now: string,
): ServiceArtifacts => {
  const id = body.id ?? randomUUID()
  return {
    def: {
      id,
      stackName: body.stackName,
      displayName: body.displayName,
      description: body.description ?? '',
      workingDirectory: body.workingDirectory,
      repositoryId: body.repositoryId,
      installCommand: body.installCommand,
      buildCommand: body.buildCommand,
      runCommand: body.runCommand,
      files: body.files ?? [],
      createdAt: now,
      updatedAt: now,
    },
    config: {
      serviceId: id,
      autoFetchEnabled: body.autoFetchEnabled ?? false,
      autoFetchIntervalMinutes: body.autoFetchIntervalMinutes ?? 60,
      autoRestartOnFetch: body.autoRestartOnFetch ?? false,
      environmentVariableOverrides: encryptEnvValues(crypto, body.environmentVariableOverrides ?? {}),
      localFiles: encryptLocalFiles(crypto, body.localFiles ?? []),
      createdAt: now,
      updatedAt: now,
    },
    status: {
      serviceId: id,
      cloneStatus: 'not-cloned',
      installStatus: 'not-installed',
      buildStatus: 'not-built',
      runStatus: 'stopped',
      updatedAt: now,
    },
    prerequisiteIds: body.prerequisiteIds ?? [],
    prerequisiteServiceIds: body.prerequisiteServiceIds ?? [],
  }
}

/**
 * Shapes the response body for `POST /services`: merges the freshly-written
 * artifacts into a `ServiceView` and masks every encrypted secret so the
 * caller never receives ciphertext.
 */
export const buildMaskedServiceView = (
  artifacts: ServiceArtifacts,
  crypto: CryptoService,
): ReturnType<typeof mergeServiceView> => {
  const relations: ServiceRelations = {
    prerequisiteIds: artifacts.prerequisiteIds,
    prerequisiteServiceIds: artifacts.prerequisiteServiceIds,
  }
  const merged = mergeServiceView(artifacts.def, artifacts.config, artifacts.status, undefined, relations)
  merged.environmentVariableOverrides = maskSensitiveEnvValues(
    crypto,
    merged.environmentVariableOverrides,
    SENSITIVE_VALUE_MASK,
  )
  merged.localFiles = maskLocalFiles(crypto, merged.localFiles)
  return merged
}
