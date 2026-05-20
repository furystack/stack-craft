import type { Injector } from '@furystack/inject'
import { getLogger } from '@furystack/logging'
import { RequestError } from '@furystack/rest'
import { JsonResult, type RequestAction } from '@furystack/rest-service'
import type { PostServiceEndpoint, ServiceRelations } from 'common'
import {
  mergeServiceView,
  ServiceConfig,
  ServiceDefinition,
  ServiceDependencyLink,
  ServicePrerequisiteLink,
  ServiceStatus,
} from 'common'
import { randomUUID } from 'crypto'

import { CryptoService, SENSITIVE_VALUE_MASK } from '../../../utils/crypto-service.js'
import {
  encryptEnvValues,
  encryptLocalFiles,
  maskLocalFiles,
  maskSensitiveEnvValues,
} from '../../../utils/env-encryption-helpers.js'
import { legacyRepository as getRepository } from '../../../utils/legacy-repository.js'

type ServiceArtifacts = {
  def: ServiceDefinition
  config: ServiceConfig
  status: ServiceStatus
  prerequisiteIds: string[]
  prerequisiteServiceIds: string[]
}

const assertNoServiceIdCollision = async (injector: Injector, id: string | undefined): Promise<void> => {
  if (id === undefined) return
  const ds = getRepository(injector).getDataSetFor(ServiceDefinition, 'id')
  const existing = await ds.get(injector, id)
  if (existing) {
    throw new RequestError(`A service with id "${id}" already exists. Choose a different id.`, 409)
  }
}

const buildServiceArtifacts = (
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
 * Inserts the supplied {@link ServiceDefinition}, {@link ServiceConfig},
 * {@link ServiceStatus} and link rows. If any individual insert throws, the
 * rows that have already been written are removed before the error is
 * re-thrown — so a failed create never leaves orphan records behind.
 *
 * Errors that are not already a {@link RequestError} are wrapped into a 500.
 */
const createServiceWithRollback = async (injector: Injector, artifacts: ServiceArtifacts): Promise<void> => {
  const repo = getRepository(injector)
  const svcDefDs = repo.getDataSetFor(ServiceDefinition, 'id')
  const svcConfigDs = repo.getDataSetFor(ServiceConfig, 'serviceId')
  const svcStatusDs = repo.getDataSetFor(ServiceStatus, 'serviceId')
  const prereqLinkDs = repo.getDataSetFor(ServicePrerequisiteLink, 'id')
  const depLinkDs = repo.getDataSetFor(ServiceDependencyLink, 'id')
  const { def, config, status, prerequisiteIds, prerequisiteServiceIds } = artifacts
  const { id } = def

  let defAdded = false
  let configAdded = false
  let statusAdded = false
  try {
    await svcDefDs.add(injector, def)
    defAdded = true
    await svcConfigDs.add(injector, config)
    configAdded = true
    await svcStatusDs.add(injector, status)
    statusAdded = true

    for (const prereqId of prerequisiteIds) {
      await prereqLinkDs.add(injector, { id: `${id}::${prereqId}`, serviceId: id, prerequisiteId: prereqId })
    }
    for (const depId of prerequisiteServiceIds) {
      await depLinkDs.add(injector, { id: `${id}::${depId}`, serviceId: id, dependsOnServiceId: depId })
    }
  } catch (error) {
    const rollbackLogger = getLogger(injector).withScope('CreateService')
    const pLinks = await prereqLinkDs.find(injector, { filter: { serviceId: { $eq: id } } }).catch(() => [])
    if (pLinks.length > 0) {
      await prereqLinkDs.remove(injector, ...pLinks.map((l) => l.id)).catch(() => undefined)
    }
    const dLinks = await depLinkDs.find(injector, { filter: { serviceId: { $eq: id } } }).catch(() => [])
    if (dLinks.length > 0) {
      await depLinkDs.remove(injector, ...dLinks.map((l) => l.id)).catch(() => undefined)
    }
    if (statusAdded) await svcStatusDs.remove(injector, id).catch(() => undefined)
    if (configAdded) await svcConfigDs.remove(injector, id).catch(() => undefined)
    if (defAdded) await svcDefDs.remove(injector, id).catch(() => undefined)
    await rollbackLogger.warning({ message: `Service creation rolled back for "${id}"`, data: { error } })
    throw error instanceof RequestError
      ? error
      : new RequestError(`Failed to create service: ${error instanceof Error ? error.message : 'unknown error'}`, 500)
  }
}

const buildMaskedServiceView = (
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

/**
 * POST action that creates a {@link ServiceDefinition} along with its
 * companion {@link ServiceConfig}, {@link ServiceStatus} and the requested
 * {@link ServicePrerequisiteLink} / {@link ServiceDependencyLink} rows.
 *
 * Rejects with `409 Conflict` when the client-supplied `body.id` matches an
 * existing service. If any later insert throws, every record written for the
 * service is removed before the error propagates (see
 * `createServiceWithRollback`).
 */
export const CreateServiceAction: RequestAction<PostServiceEndpoint> = async ({ injector, getBody }) => {
  const body = await getBody()
  const crypto = injector.get(CryptoService)
  const now = new Date().toISOString()

  await assertNoServiceIdCollision(injector, body.id)
  const artifacts = buildServiceArtifacts(body, crypto, now)
  await createServiceWithRollback(injector, artifacts)
  return JsonResult(buildMaskedServiceView(artifacts, crypto))
}
