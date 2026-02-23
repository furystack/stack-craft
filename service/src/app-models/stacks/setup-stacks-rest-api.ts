import type { Injector } from '@furystack/inject'
import '@furystack/repository'
import { getRepository } from '@furystack/repository'
import { RequestError } from '@furystack/rest'
import { JsonResult, useRestService, Validate } from '@furystack/rest-service'
import type { StacksApi, StackView } from 'common'
import {
  GitHubRepository,
  Prerequisite,
  ServiceConfig,
  ServiceDefinition,
  ServiceStatus,
  StackConfig,
  StackDefinition,
} from 'common'
import stacksApiSchema from 'common/schemas/stacks-api.json' with { type: 'json' }
import { randomUUID } from 'crypto'

import { getCurrentUser } from '@furystack/core'

import { getCorsOptions } from '../../get-cors-options.js'
import { getPort } from '../../get-port.js'
import { ProcessManager } from '../../services/process-manager.js'
import { ExportStackAction } from './actions/export-stack-action.js'
import { ImportStackAction } from './actions/import-stack-action.js'

export const setupStacksRestApi = async (injector: Injector) => {
  await useRestService<StacksApi>({
    injector,
    root: 'api/stacks',
    port: getPort(),
    cors: getCorsOptions(),
    api: {
      GET: {
        '/stacks': async ({ injector: i, getQuery }) => {
          const query = getQuery()
          const repo = getRepository(i)
          const defs = await repo.getDataSetFor(StackDefinition, 'name').find(i, {
            top: query.findOptions?.top,
            skip: query.findOptions?.skip,
            order: query.findOptions?.order,
            filter: query.findOptions?.filter,
          })
          const configs = await repo.getDataSetFor(StackConfig, 'stackName').find(i, {})
          const configMap = new Map(configs.map((c) => [c.stackName, c]))
          const entries = defs.map(
            (def) =>
              ({
                ...def,
                ...(configMap.get(def.name) ?? { stackName: def.name, mainDirectory: '' }),
              }) as StackView,
          )
          return JsonResult({ count: entries.length, entries })
        },
        '/stacks/:id': async ({ injector: i, getUrlParams }) => {
          const { id } = getUrlParams()
          const repo = getRepository(i)
          const defs = await repo
            .getDataSetFor(StackDefinition, 'name')
            .find(i, { filter: { name: { $eq: id } }, top: 1 })
          const def = defs[0]
          if (!def) throw new RequestError('Stack not found', 404)
          const configs = await repo
            .getDataSetFor(StackConfig, 'stackName')
            .find(i, { filter: { stackName: { $eq: id } }, top: 1 })
          const config = configs[0]
          if (!config) throw new RequestError('Stack config not found', 404)
          return JsonResult({ ...def, ...config })
        },
        '/stacks/:id/export': Validate({ schema: stacksApiSchema, schemaName: 'ExportStackEndpoint' })(
          ExportStackAction,
        ),
      },
      POST: {
        '/stacks': async ({ injector: i, getBody }) => {
          const body = await getBody()
          const repo = getRepository(i)
          const now = new Date().toISOString()
          const name = body.name ?? randomUUID()
          const def = {
            name,
            displayName: body.displayName,
            description: body.description ?? '',
            createdAt: now,
            updatedAt: now,
          }
          const config = { stackName: name, mainDirectory: body.mainDirectory, createdAt: now, updatedAt: now }
          await repo.getDataSetFor(StackDefinition, 'name').add(i, def)
          await repo.getDataSetFor(StackConfig, 'stackName').add(i, config)
          return JsonResult({ ...def, ...config })
        },
        '/stacks/import': Validate({ schema: stacksApiSchema, schemaName: 'ImportStackEndpoint' })(ImportStackAction),
        '/stacks/:id/setup': async ({ injector: i, getUrlParams }) => {
          const { id } = getUrlParams()
          const repo = getRepository(i)
          const svcDs = repo.getDataSetFor(ServiceDefinition, 'id')
          const svcs = await svcDs.find(i, { filter: { stackName: { $eq: id } }, select: ['id'] })
          if (svcs.length === 0) throw new RequestError('No services found in this stack', 404)

          let username = 'unknown'
          try {
            const { username: resolvedUsername } = (await getCurrentUser(i)) ?? {}
            if (resolvedUsername) username = resolvedUsername
          } catch {
            // Identity context may not be available
          }
          const trigger = { triggeredBy: username, triggerSource: 'api' as const }

          const pm = i.getInstance(ProcessManager)
          await pm.setupServices(
            svcs.map((s) => s.id),
            trigger,
          )
          return JsonResult({ success: true })
        },
      },
      PATCH: {
        '/stacks/:id': async ({ injector: i, getUrlParams, getBody }) => {
          const { id } = getUrlParams()
          const body = await getBody()
          const repo = getRepository(i)

          const defFields: Partial<StackDefinition> = {}
          if (body.displayName !== undefined) defFields.displayName = body.displayName
          if (body.description !== undefined) defFields.description = body.description

          const configFields: Partial<StackConfig> = {}
          if (body.mainDirectory !== undefined) configFields.mainDirectory = body.mainDirectory

          if (Object.keys(defFields).length > 0) {
            await repo.getDataSetFor(StackDefinition, 'name').update(i, id, defFields)
          }
          if (Object.keys(configFields).length > 0) {
            await repo.getDataSetFor(StackConfig, 'stackName').update(i, id, configFields)
          }

          return JsonResult({})
        },
      },
      DELETE: {
        '/stacks/:id': async ({ injector: i, getUrlParams }) => {
          const { id } = getUrlParams()
          const repo = getRepository(i)

          const svcDs = repo.getDataSetFor(ServiceDefinition, 'id')
          const svcs = await svcDs.find(i, { filter: { stackName: { $eq: id } }, select: ['id'] })
          const svcIds = svcs.map((svc) => svc.id)
          if (svcIds.length > 0) {
            // Cascade-delete child records; some may not exist
            await repo
              .getDataSetFor(ServiceStatus, 'serviceId')
              .remove(i, ...svcIds)
              .catch(() => {
                /* Child records may not exist */
              })
            await repo
              .getDataSetFor(ServiceConfig, 'serviceId')
              .remove(i, ...svcIds)
              .catch(() => {
                /* Child records may not exist */
              })
            await svcDs.remove(i, ...svcIds).catch(() => {
              /* Already removed */
            })
          }

          const repos = await repo
            .getDataSetFor(GitHubRepository, 'id')
            .find(i, { filter: { stackName: { $eq: id } }, select: ['id'] })
          const repoIds = repos.map((r) => r.id)
          if (repoIds.length > 0) {
            await repo
              .getDataSetFor(GitHubRepository, 'id')
              .remove(i, ...repoIds)
              .catch(() => {
                /* Already removed */
              })
          }

          const prereqs = await repo
            .getDataSetFor(Prerequisite, 'id')
            .find(i, { filter: { stackName: { $eq: id } }, select: ['id'] })
          const prereqIds = prereqs.map((p) => p.id)
          if (prereqIds.length > 0) {
            await repo
              .getDataSetFor(Prerequisite, 'id')
              .remove(i, ...prereqIds)
              .catch(() => {
                /* Already removed */
              })
          }

          await repo
            .getDataSetFor(StackConfig, 'stackName')
            .remove(i, id)
            .catch(() => {
              /* Config may not exist */
            })
          await repo.getDataSetFor(StackDefinition, 'name').remove(i, id)

          return JsonResult({})
        },
      },
    },
  })
}
