import type { Injector } from '@furystack/inject'
import { getLogger } from '@furystack/logging'
import '@furystack/repository'
import { getRepository } from '@furystack/repository'
import { RequestError } from '@furystack/rest'
import { JsonResult, useRestService, Validate } from '@furystack/rest-service'
import type { ServicesApi } from 'common'
import type { ServiceRelations } from 'common'
import {
  mergeServiceView,
  ServiceConfig,
  ServiceDefinition,
  ServiceDependencyLink,
  ServiceGitStatus,
  ServicePrerequisiteLink,
  ServiceStatus,
} from 'common'
import servicesApiSchema from 'common/schemas/services-api.json' with { type: 'json' }
import { randomUUID } from 'crypto'

import { getCorsOptions } from '../../get-cors-options.js'
import { getPort } from '../../get-port.js'
import { ProcessManager } from '../../services/process-manager.js'
import { CryptoService, SENSITIVE_VALUE_MASK } from '../../utils/crypto-service.js'
import {
  encryptEnvValues,
  encryptLocalFiles,
  maskLocalFiles,
  maskSensitiveEnvValues,
} from '../../utils/env-encryption-helpers.js'
import { ClearServiceLogsAction } from './actions/clear-service-logs-action.js'
import { ServiceBranchesAction } from './actions/service-branches-action.js'
import { ServiceCheckoutAction } from './actions/service-checkout-action.js'
import { ServiceHistoryAction } from './actions/service-history-action.js'
import { ServiceLifecycleAction } from './actions/service-lifecycle-action.js'
import { ServiceLogsAction } from './actions/service-logs-action.js'

const mergeServiceViewMasked = (
  def: ServiceDefinition,
  config: ServiceConfig | undefined,
  status: ServiceStatus | undefined,
  gitStatus: ServiceGitStatus | undefined,
  crypto: CryptoService,
  relations?: ServiceRelations,
) => {
  const merged = mergeServiceView(def, config, status, gitStatus, relations)
  merged.environmentVariableOverrides = maskSensitiveEnvValues(
    crypto,
    merged.environmentVariableOverrides,
    SENSITIVE_VALUE_MASK,
  )
  merged.localFiles = maskLocalFiles(crypto, merged.localFiles)
  return merged
}

const resolveRelationsForServices = async (
  injector: Injector,
  serviceIds: string[],
): Promise<Map<string, ServiceRelations>> => {
  const repo = getRepository(injector)
  const prereqLinks = await repo.getDataSetFor(ServicePrerequisiteLink, 'id').find(injector, {})
  const depLinks = await repo.getDataSetFor(ServiceDependencyLink, 'id').find(injector, {})
  const targetSet = new Set(serviceIds)

  const relationsMap = new Map<string, ServiceRelations>()
  for (const id of serviceIds) {
    relationsMap.set(id, { prerequisiteIds: [], prerequisiteServiceIds: [] })
  }
  for (const link of prereqLinks) {
    if (targetSet.has(link.serviceId)) {
      relationsMap.get(link.serviceId)!.prerequisiteIds.push(link.prerequisiteId)
    }
  }
  for (const link of depLinks) {
    if (targetSet.has(link.serviceId)) {
      relationsMap.get(link.serviceId)!.prerequisiteServiceIds.push(link.dependsOnServiceId)
    }
  }
  return relationsMap
}

const setServiceLinks = async (
  injector: Injector,
  serviceId: string,
  prerequisiteIds: string[],
  prerequisiteServiceIds: string[],
) => {
  const repo = getRepository(injector)
  const prereqDs = repo.getDataSetFor(ServicePrerequisiteLink, 'id')
  const depDs = repo.getDataSetFor(ServiceDependencyLink, 'id')

  for (const prereqId of prerequisiteIds) {
    await prereqDs.add(injector, { id: `${serviceId}::${prereqId}`, serviceId, prerequisiteId: prereqId })
  }
  for (const depId of prerequisiteServiceIds) {
    await depDs.add(injector, { id: `${serviceId}::${depId}`, serviceId, dependsOnServiceId: depId })
  }
}

const replaceServiceLinks = async (
  injector: Injector,
  serviceId: string,
  prerequisiteIds?: string[],
  prerequisiteServiceIds?: string[],
) => {
  const repo = getRepository(injector)

  if (prerequisiteIds !== undefined) {
    const prereqDs = repo.getDataSetFor(ServicePrerequisiteLink, 'id')
    const existing = await prereqDs.find(injector, { filter: { serviceId: { $eq: serviceId } } })
    if (existing.length > 0) {
      await prereqDs.remove(injector, ...existing.map((l) => l.id))
    }
    for (const prereqId of prerequisiteIds) {
      await prereqDs.add(injector, { id: `${serviceId}::${prereqId}`, serviceId, prerequisiteId: prereqId })
    }
  }

  if (prerequisiteServiceIds !== undefined) {
    const depDs = repo.getDataSetFor(ServiceDependencyLink, 'id')
    const existing = await depDs.find(injector, { filter: { serviceId: { $eq: serviceId } } })
    if (existing.length > 0) {
      await depDs.remove(injector, ...existing.map((l) => l.id))
    }
    for (const depId of prerequisiteServiceIds) {
      await depDs.add(injector, { id: `${serviceId}::${depId}`, serviceId, dependsOnServiceId: depId })
    }
  }
}

export const setupServicesRestApi = async (injector: Injector) => {
  await useRestService<ServicesApi>({
    injector,
    root: 'api/services',
    port: getPort(),
    cors: getCorsOptions(),
    api: {
      GET: {
        '/services': Validate({ schema: servicesApiSchema, schemaName: 'GetCollectionEndpoint<ServiceView>' })(
          async ({ injector: i, getQuery }) => {
            const query = getQuery()
            const repo = getRepository(i)
            const crypto = i.getInstance(CryptoService)
            const defs = await repo.getDataSetFor(ServiceDefinition, 'id').find(i, {
              top: query.findOptions?.top,
              skip: query.findOptions?.skip,
              order: query.findOptions?.order,
              filter: query.findOptions?.filter,
            })
            const configs = await repo.getDataSetFor(ServiceConfig, 'serviceId').find(i, {})
            const statuses = await repo.getDataSetFor(ServiceStatus, 'serviceId').find(i, {})
            const gitStatuses = await repo.getDataSetFor(ServiceGitStatus, 'serviceId').find(i, {})
            const configMap = new Map(configs.map((c) => [c.serviceId, c]))
            const statusMap = new Map(statuses.map((s) => [s.serviceId, s]))
            const gitStatusMap = new Map(gitStatuses.map((g) => [g.serviceId, g]))
            const relationsMap = await resolveRelationsForServices(
              i,
              defs.map((d) => d.id),
            )

            const entries = defs.map((def) =>
              mergeServiceViewMasked(
                def,
                configMap.get(def.id),
                statusMap.get(def.id),
                gitStatusMap.get(def.id),
                crypto,
                relationsMap.get(def.id),
              ),
            )
            const count = await repo.getDataSetFor(ServiceDefinition, 'id').count(i, query.findOptions?.filter)
            return JsonResult({ count, entries })
          },
        ),
        '/services/:id': Validate({ schema: servicesApiSchema, schemaName: 'GetEntityEndpoint<ServiceView,"id">' })(
          async ({ injector: i, getUrlParams }) => {
            const { id } = getUrlParams()
            const repo = getRepository(i)
            const crypto = i.getInstance(CryptoService)
            const defs = await repo
              .getDataSetFor(ServiceDefinition, 'id')
              .find(i, { filter: { id: { $eq: id } }, top: 1 })
            const def = defs[0]
            if (!def) throw new RequestError('Service not found', 404)

            const configs = await repo
              .getDataSetFor(ServiceConfig, 'serviceId')
              .find(i, { filter: { serviceId: { $eq: id } }, top: 1 })
            const statuses = await repo
              .getDataSetFor(ServiceStatus, 'serviceId')
              .find(i, { filter: { serviceId: { $eq: id } }, top: 1 })
            const gitStatuses = await repo
              .getDataSetFor(ServiceGitStatus, 'serviceId')
              .find(i, { filter: { serviceId: { $eq: id } }, top: 1 })

            const relationsMap = await resolveRelationsForServices(i, [id])
            return JsonResult(
              mergeServiceViewMasked(def, configs[0], statuses[0], gitStatuses[0], crypto, relationsMap.get(id)),
            )
          },
        ),
        '/services/:id/logs': Validate({ schema: servicesApiSchema, schemaName: 'ServiceLogsEndpoint' })(
          ServiceLogsAction,
        ),
        '/services/:id/history': Validate({ schema: servicesApiSchema, schemaName: 'ServiceHistoryEndpoint' })(
          ServiceHistoryAction,
        ),
        '/services/:id/branches': Validate({ schema: servicesApiSchema, schemaName: 'ServiceBranchesEndpoint' })(
          ServiceBranchesAction,
        ),
      },
      POST: {
        '/services': Validate({ schema: servicesApiSchema, schemaName: 'PostServiceEndpoint' })(
          async ({ injector: i, getBody }) => {
            const body = await getBody()
            const repo = getRepository(i)
            const crypto = i.getInstance(CryptoService)
            const now = new Date().toISOString()
            const id = body.id ?? randomUUID()

            const prerequisiteIds = body.prerequisiteIds ?? []
            const prerequisiteServiceIds = body.prerequisiteServiceIds ?? []

            const def = {
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
            }

            const config = {
              serviceId: id,
              autoFetchEnabled: body.autoFetchEnabled ?? false,
              autoFetchIntervalMinutes: body.autoFetchIntervalMinutes ?? 60,
              autoRestartOnFetch: body.autoRestartOnFetch ?? false,
              environmentVariableOverrides: encryptEnvValues(crypto, body.environmentVariableOverrides ?? {}),
              localFiles: encryptLocalFiles(crypto, body.localFiles ?? []),
              createdAt: now,
              updatedAt: now,
            }

            const status = {
              serviceId: id,
              cloneStatus: 'not-cloned' as const,
              installStatus: 'not-installed' as const,
              buildStatus: 'not-built' as const,
              runStatus: 'stopped' as const,
              updatedAt: now,
            }

            await repo.getDataSetFor(ServiceDefinition, 'id').add(i, def)
            await repo.getDataSetFor(ServiceConfig, 'serviceId').add(i, config)
            await repo.getDataSetFor(ServiceStatus, 'serviceId').add(i, status)
            await setServiceLinks(i, id, prerequisiteIds, prerequisiteServiceIds)

            const relations = { prerequisiteIds, prerequisiteServiceIds }
            return JsonResult(mergeServiceViewMasked(def, config, status, undefined, crypto, relations))
          },
        ),
        '/services/:id/start': Validate({ schema: servicesApiSchema, schemaName: 'ServiceActionEndpoint' })(
          ServiceLifecycleAction('start'),
        ),
        '/services/:id/stop': Validate({ schema: servicesApiSchema, schemaName: 'ServiceActionEndpoint' })(
          ServiceLifecycleAction('stop'),
        ),
        '/services/:id/restart': Validate({ schema: servicesApiSchema, schemaName: 'ServiceActionEndpoint' })(
          ServiceLifecycleAction('restart'),
        ),
        '/services/:id/install': Validate({ schema: servicesApiSchema, schemaName: 'ServiceActionEndpoint' })(
          ServiceLifecycleAction('install'),
        ),
        '/services/:id/build': Validate({ schema: servicesApiSchema, schemaName: 'ServiceActionEndpoint' })(
          ServiceLifecycleAction('build'),
        ),
        '/services/:id/pull': Validate({ schema: servicesApiSchema, schemaName: 'ServiceActionEndpoint' })(
          ServiceLifecycleAction('pull'),
        ),
        '/services/:id/setup': Validate({ schema: servicesApiSchema, schemaName: 'ServiceActionEndpoint' })(
          ServiceLifecycleAction('setup'),
        ),
        '/services/:id/update': Validate({ schema: servicesApiSchema, schemaName: 'ServiceActionEndpoint' })(
          ServiceLifecycleAction('update'),
        ),
        '/services/:id/checkout': Validate({ schema: servicesApiSchema, schemaName: 'ServiceCheckoutEndpoint' })(
          ServiceCheckoutAction,
        ),
        '/services/:id/apply-files': Validate({
          schema: servicesApiSchema,
          schemaName: 'ApplyServiceFilesEndpoint',
        })(async ({ injector: i, getUrlParams, getBody }) => {
          const { id: serviceId } = getUrlParams()
          const body = await getBody()
          try {
            const applied = await i.getInstance(ProcessManager).applyFiles(serviceId, body.relativePath)
            return JsonResult({ success: true, serviceId, applied })
          } catch (error) {
            throw new RequestError(error instanceof Error ? error.message : 'Failed to apply files', 500)
          }
        }),
      },
      PATCH: {
        '/services/:id': Validate({ schema: servicesApiSchema, schemaName: 'PatchServiceEndpoint' })(
          async ({ injector: i, getUrlParams, getBody }) => {
            const { id } = getUrlParams()
            const body = await getBody()
            const repo = getRepository(i)

            const defFields: Partial<ServiceDefinition> = {}
            if (body.displayName !== undefined) defFields.displayName = body.displayName
            if (body.description !== undefined) defFields.description = body.description
            if (body.workingDirectory !== undefined) defFields.workingDirectory = body.workingDirectory
            if (body.repositoryId !== undefined) defFields.repositoryId = body.repositoryId
            if (body.installCommand !== undefined) defFields.installCommand = body.installCommand
            if (body.buildCommand !== undefined) defFields.buildCommand = body.buildCommand
            if (body.runCommand !== undefined) defFields.runCommand = body.runCommand
            if (body.files !== undefined) defFields.files = body.files

            const configFields: Partial<ServiceConfig> = {}
            if (body.autoFetchEnabled !== undefined) configFields.autoFetchEnabled = body.autoFetchEnabled
            if (body.autoFetchIntervalMinutes !== undefined)
              configFields.autoFetchIntervalMinutes = body.autoFetchIntervalMinutes
            if (body.autoRestartOnFetch !== undefined) configFields.autoRestartOnFetch = body.autoRestartOnFetch

            const needsExisting = body.environmentVariableOverrides !== undefined || body.localFiles !== undefined
            const existing = needsExisting
              ? (
                  await repo
                    .getDataSetFor(ServiceConfig, 'serviceId')
                    .find(i, { filter: { serviceId: { $eq: id } }, top: 1 })
                )[0]
              : undefined

            if (body.environmentVariableOverrides !== undefined) {
              const crypto = i.getInstance(CryptoService)
              configFields.environmentVariableOverrides = encryptEnvValues(
                crypto,
                body.environmentVariableOverrides,
                existing?.environmentVariableOverrides,
              )
            }
            if (body.localFiles !== undefined) {
              const crypto = i.getInstance(CryptoService)
              configFields.localFiles = encryptLocalFiles(crypto, body.localFiles, existing?.localFiles)
            }

            if (Object.keys(defFields).length > 0) {
              await repo.getDataSetFor(ServiceDefinition, 'id').update(i, id, defFields)
            }
            if (Object.keys(configFields).length > 0) {
              await repo.getDataSetFor(ServiceConfig, 'serviceId').update(i, id, configFields)
            }
            await replaceServiceLinks(i, id, body.prerequisiteIds, body.prerequisiteServiceIds)

            return JsonResult({})
          },
        ),
      },
      DELETE: {
        '/services/:id': Validate({ schema: servicesApiSchema, schemaName: 'DeleteEndpoint<ServiceDefinition,"id">' })(
          async ({ injector: i, getUrlParams }) => {
            const { id } = getUrlParams()
            const repo = getRepository(i)
            const deleteLogger = getLogger(i).withScope('DeleteService')
            await repo
              .getDataSetFor(ServiceStatus, 'serviceId')
              .remove(i, id)
              .catch(
                (e) =>
                  void deleteLogger.warning({
                    message: 'Failed to remove service status during delete',
                    data: { serviceId: id, error: e },
                  }),
              )
            await repo
              .getDataSetFor(ServiceConfig, 'serviceId')
              .remove(i, id)
              .catch(
                (e) =>
                  void deleteLogger.warning({
                    message: 'Failed to remove service config during delete',
                    data: { serviceId: id, error: e },
                  }),
              )
            await repo.getDataSetFor(ServiceDefinition, 'id').remove(i, id)
            return JsonResult({})
          },
        ),
        '/services/:id/logs': Validate({ schema: servicesApiSchema, schemaName: 'ClearServiceLogsEndpoint' })(
          ClearServiceLogsAction,
        ),
      },
    },
  })
}
