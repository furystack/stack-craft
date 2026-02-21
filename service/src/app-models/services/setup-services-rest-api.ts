import type { Injector } from '@furystack/inject'
import '@furystack/repository'
import { getRepository } from '@furystack/repository'
import { RequestError } from '@furystack/rest'
import { JsonResult, useRestService, Validate } from '@furystack/rest-service'
import type { ServicesApi, ServiceView } from 'common'
import { ServiceConfig, ServiceDefinition, ServiceStatus } from 'common'
import servicesApiSchema from 'common/schemas/services-api.json' with { type: 'json' }
import { randomUUID } from 'crypto'

import { getCorsOptions } from '../../get-cors-options.js'
import { getPort } from '../../get-port.js'
import { ClearServiceLogsAction } from './actions/clear-service-logs-action.js'
import { ServiceHistoryAction } from './actions/service-history-action.js'
import { ServiceLifecycleAction } from './actions/service-lifecycle-action.js'
import { ServiceLogsAction } from './actions/service-logs-action.js'

const mergeServiceView = (
  def: ServiceDefinition,
  config: ServiceConfig | undefined,
  status: ServiceStatus | undefined,
): ServiceView => ({
  serviceId: def.id,
  autoFetchEnabled: false,
  autoFetchIntervalMinutes: 60,
  autoRestartOnFetch: false,
  installStatus: 'not-installed',
  buildStatus: 'not-built',
  runStatus: 'stopped',
  ...def,
  ...(config ?? {}),
  ...(status ?? {}),
})

export const setupServicesRestApi = async (injector: Injector) => {
  await useRestService<ServicesApi>({
    injector,
    root: 'api/services',
    port: getPort(),
    cors: getCorsOptions(),
    api: {
      GET: {
        '/services': async ({ injector: i, getQuery }) => {
          const query = getQuery()
          const repo = getRepository(i)
          const defs = await repo.getDataSetFor(ServiceDefinition, 'id').find(i, {
            top: query.findOptions?.top,
            skip: query.findOptions?.skip,
            order: query.findOptions?.order,
            filter: query.findOptions?.filter,
          })
          const configs = await repo.getDataSetFor(ServiceConfig, 'serviceId').find(i, {})
          const statuses = await repo.getDataSetFor(ServiceStatus, 'serviceId').find(i, {})
          const configMap = new Map(configs.map((c) => [c.serviceId, c]))
          const statusMap = new Map(statuses.map((s) => [s.serviceId, s]))

          const entries = defs.map((def) => mergeServiceView(def, configMap.get(def.id), statusMap.get(def.id)))
          const count = await repo.getDataSetFor(ServiceDefinition, 'id').count(i, query.findOptions?.filter)
          return JsonResult({ count, entries })
        },
        '/services/:id': async ({ injector: i, getUrlParams }) => {
          const { id } = getUrlParams()
          const repo = getRepository(i)
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

          return JsonResult(mergeServiceView(def, configs[0], statuses[0]))
        },
        '/services/:id/logs': Validate({ schema: servicesApiSchema, schemaName: 'ServiceLogsEndpoint' })(
          ServiceLogsAction,
        ),
        '/services/:id/history': ServiceHistoryAction,
      },
      POST: {
        '/services': async ({ injector: i, getBody }) => {
          const body = await getBody()
          const repo = getRepository(i)
          const now = new Date().toISOString()
          const id = body.id ?? randomUUID()

          const def = {
            id,
            stackName: body.stackName,
            displayName: body.displayName,
            description: body.description ?? '',
            workingDirectory: body.workingDirectory,
            repositoryId: body.repositoryId,
            dependencyIds: body.dependencyIds ?? [],
            prerequisiteServiceIds: body.prerequisiteServiceIds ?? [],
            installCommand: body.installCommand,
            buildCommand: body.buildCommand,
            runCommand: body.runCommand,
            createdAt: now,
            updatedAt: now,
          }

          const config = {
            serviceId: id,
            autoFetchEnabled: body.autoFetchEnabled ?? false,
            autoFetchIntervalMinutes: body.autoFetchIntervalMinutes ?? 60,
            autoRestartOnFetch: body.autoRestartOnFetch ?? false,
            createdAt: now,
            updatedAt: now,
          }

          const status = {
            serviceId: id,
            installStatus: 'not-installed' as const,
            buildStatus: 'not-built' as const,
            runStatus: 'stopped' as const,
            updatedAt: now,
          }

          await repo.getDataSetFor(ServiceDefinition, 'id').add(i, def)
          await repo.getDataSetFor(ServiceConfig, 'serviceId').add(i, config)
          await repo.getDataSetFor(ServiceStatus, 'serviceId').add(i, status)

          return JsonResult(mergeServiceView(def, config, status))
        },
        '/services/:id/start': ServiceLifecycleAction('start'),
        '/services/:id/stop': ServiceLifecycleAction('stop'),
        '/services/:id/restart': ServiceLifecycleAction('restart'),
        '/services/:id/install': ServiceLifecycleAction('install'),
        '/services/:id/build': ServiceLifecycleAction('build'),
        '/services/:id/pull': ServiceLifecycleAction('pull'),
      },
      PATCH: {
        '/services/:id': async ({ injector: i, getUrlParams, getBody }) => {
          const { id } = getUrlParams()
          const body = await getBody()
          const repo = getRepository(i)

          const defFields: Partial<ServiceDefinition> = {}
          if (body.displayName !== undefined) defFields.displayName = body.displayName
          if (body.description !== undefined) defFields.description = body.description
          if (body.workingDirectory !== undefined) defFields.workingDirectory = body.workingDirectory
          if (body.repositoryId !== undefined) defFields.repositoryId = body.repositoryId
          if (body.dependencyIds !== undefined) defFields.dependencyIds = body.dependencyIds
          if (body.prerequisiteServiceIds !== undefined) defFields.prerequisiteServiceIds = body.prerequisiteServiceIds
          if (body.installCommand !== undefined) defFields.installCommand = body.installCommand
          if (body.buildCommand !== undefined) defFields.buildCommand = body.buildCommand
          if (body.runCommand !== undefined) defFields.runCommand = body.runCommand

          const configFields: Partial<ServiceConfig> = {}
          if (body.autoFetchEnabled !== undefined) configFields.autoFetchEnabled = body.autoFetchEnabled
          if (body.autoFetchIntervalMinutes !== undefined)
            configFields.autoFetchIntervalMinutes = body.autoFetchIntervalMinutes
          if (body.autoRestartOnFetch !== undefined) configFields.autoRestartOnFetch = body.autoRestartOnFetch

          if (Object.keys(defFields).length > 0) {
            await repo.getDataSetFor(ServiceDefinition, 'id').update(i, id, defFields)
          }
          if (Object.keys(configFields).length > 0) {
            await repo.getDataSetFor(ServiceConfig, 'serviceId').update(i, id, configFields)
          }

          return JsonResult({})
        },
      },
      DELETE: {
        '/services/:id': async ({ injector: i, getUrlParams }) => {
          const { id } = getUrlParams()
          const repo = getRepository(i)
          await repo
            .getDataSetFor(ServiceStatus, 'serviceId')
            .remove(i, id)
            .catch(() => {
              /* Status row may not exist */
            })
          await repo
            .getDataSetFor(ServiceConfig, 'serviceId')
            .remove(i, id)
            .catch(() => {
              /* Config row may not exist */
            })
          await repo.getDataSetFor(ServiceDefinition, 'id').remove(i, id)
          return JsonResult({})
        },
        '/services/:id/logs': ClearServiceLogsAction,
      },
    },
  })
}
