import type { Injector } from '@furystack/inject'
import { getLogger } from '@furystack/logging'
import '@furystack/repository'
import { RequestError } from '@furystack/rest'
import { JsonResult, useRestService, Validate } from '@furystack/rest-service'
import type { StacksApi } from 'common'
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
import { getHost } from '../../get-host.js'
import { getPort } from '../../get-port.js'
import { ProcessManager } from '../../services/process-manager.js'
import { CryptoService, SENSITIVE_VALUE_MASK } from '../../utils/crypto-service.js'
import { encryptEnvValues, maskSensitiveEnvValues } from '../../utils/env-encryption-helpers.js'
import { ExportStackAction } from './actions/export-stack-action.js'
import { ImportStackAction } from './actions/import-stack-action.js'
import { legacyRepository as getRepository } from '../../utils/legacy-repository.js'

export const setupStacksRestApi = async (injector: Injector) => {
  await useRestService<StacksApi>({
    injector,
    root: 'api/stacks',
    hostName: getHost(),
    port: getPort(),
    cors: getCorsOptions(),
    api: {
      GET: {
        '/stacks': Validate({ schema: stacksApiSchema, schemaName: 'GetCollectionEndpoint<StackView>' })(
          async ({ injector: i, getQuery }) => {
            const query = getQuery()
            const repo = getRepository(i)
            const crypto = i.get(CryptoService)
            const defs = await repo.getDataSetFor(StackDefinition, 'name').find(i, {
              top: query.findOptions?.top,
              skip: query.findOptions?.skip,
              order: query.findOptions?.order,
              filter: query.findOptions?.filter,
            })
            const configs = await repo.getDataSetFor(StackConfig, 'stackName').find(i, {})
            const configMap = new Map(configs.map((c) => [c.stackName, c]))
            const entries = defs.map((def) => {
              const config = configMap.get(def.name) ?? {
                stackName: def.name,
                mainDirectory: '',
                environmentVariables: {},
              }
              return {
                ...def,
                ...config,
                environmentVariables: maskSensitiveEnvValues(
                  crypto,
                  config.environmentVariables ?? {},
                  SENSITIVE_VALUE_MASK,
                ),
              }
            })
            return JsonResult({ count: entries.length, entries })
          },
        ),
        '/stacks/:id': Validate({ schema: stacksApiSchema, schemaName: 'GetEntityEndpoint<StackView,"name">' })(
          async ({ injector: i, getUrlParams }) => {
            const { id } = getUrlParams()
            const repo = getRepository(i)
            const crypto = i.get(CryptoService)
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
            return JsonResult({
              ...def,
              ...config,
              environmentVariables: maskSensitiveEnvValues(crypto, config.environmentVariables, SENSITIVE_VALUE_MASK),
            })
          },
        ),
        '/stacks/:id/export': Validate({ schema: stacksApiSchema, schemaName: 'ExportStackEndpoint' })(
          ExportStackAction,
        ),
      },
      POST: {
        '/stacks': Validate({ schema: stacksApiSchema, schemaName: 'PostStackEndpoint' })(
          async ({ injector: i, getBody }) => {
            const body = await getBody()
            const repo = getRepository(i)
            const crypto = i.get(CryptoService)
            const now = new Date().toISOString()
            const stackDefDs = repo.getDataSetFor(StackDefinition, 'name')

            if (body.name !== undefined) {
              const existing = await stackDefDs.get(i, body.name)
              if (existing) {
                throw new RequestError(`A stack named "${body.name}" already exists. Choose a different name.`, 409)
              }
            }

            const name = body.name ?? randomUUID()
            const def = {
              name,
              displayName: body.displayName,
              description: body.description ?? '',
              createdAt: now,
              updatedAt: now,
            }
            const config = {
              stackName: name,
              mainDirectory: body.mainDirectory,
              environmentVariables: encryptEnvValues(crypto, body.environmentVariables ?? {}),
              createdAt: now,
              updatedAt: now,
            }
            await stackDefDs.add(i, def)
            try {
              await repo.getDataSetFor(StackConfig, 'stackName').add(i, config)
            } catch (error) {
              await stackDefDs.remove(i, name).catch(() => undefined)
              throw error instanceof RequestError
                ? error
                : new RequestError(
                    `Failed to create stack "${name}": ${error instanceof Error ? error.message : 'unknown error'}`,
                    500,
                  )
            }
            return JsonResult({ ...def, ...config })
          },
        ),
        '/stacks/import': Validate({ schema: stacksApiSchema, schemaName: 'ImportStackEndpoint' })(ImportStackAction),
        '/stacks/:id/setup': Validate({ schema: stacksApiSchema, schemaName: 'StackSetupEndpoint' })(
          async ({ injector: i, getUrlParams }) => {
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

            const pm = i.get(ProcessManager)
            await pm.setupServices(
              svcs.map((s) => s.id),
              trigger,
            )
            return JsonResult({ success: true })
          },
        ),
      },
      PATCH: {
        '/stacks/:id': Validate({ schema: stacksApiSchema, schemaName: 'PatchStackEndpoint' })(
          async ({ injector: i, getUrlParams, getBody }) => {
            const { id } = getUrlParams()
            const body = await getBody()
            const repo = getRepository(i)
            const crypto = i.get(CryptoService)

            const defFields: Partial<StackDefinition> = {}
            if (body.displayName !== undefined) defFields.displayName = body.displayName
            if (body.description !== undefined) defFields.description = body.description

            const configFields: Partial<StackConfig> = {}
            if (body.mainDirectory !== undefined) configFields.mainDirectory = body.mainDirectory
            if (body.environmentVariables !== undefined) {
              const existing = await repo
                .getDataSetFor(StackConfig, 'stackName')
                .find(i, { filter: { stackName: { $eq: id } }, top: 1 })
              configFields.environmentVariables = encryptEnvValues(
                crypto,
                body.environmentVariables,
                existing[0]?.environmentVariables,
              )
            }

            if (Object.keys(defFields).length > 0) {
              await repo.getDataSetFor(StackDefinition, 'name').update(i, id, defFields)
            }
            if (Object.keys(configFields).length > 0) {
              await repo.getDataSetFor(StackConfig, 'stackName').update(i, id, configFields)
            }

            return JsonResult({})
          },
        ),
      },
      DELETE: {
        '/stacks/:id': Validate({ schema: stacksApiSchema, schemaName: 'DeleteEndpoint<StackDefinition,"name">' })(
          async ({ injector: i, getUrlParams }) => {
            const { id } = getUrlParams()
            const repo = getRepository(i)

            const svcDs = repo.getDataSetFor(ServiceDefinition, 'id')
            const svcs = await svcDs.find(i, { filter: { stackName: { $eq: id } }, select: ['id'] })
            const svcIds = svcs.map((svc) => svc.id)
            const deleteLogger = getLogger(i).withScope('DeleteStack')
            if (svcIds.length > 0) {
              await repo
                .getDataSetFor(ServiceStatus, 'serviceId')
                .remove(i, ...svcIds)
                .catch(
                  (e) =>
                    void deleteLogger.warning({
                      message: 'Failed to remove service statuses during stack delete',
                      data: { stackName: id, error: e },
                    }),
                )
              await repo
                .getDataSetFor(ServiceConfig, 'serviceId')
                .remove(i, ...svcIds)
                .catch(
                  (e) =>
                    void deleteLogger.warning({
                      message: 'Failed to remove service configs during stack delete',
                      data: { stackName: id, error: e },
                    }),
                )
              await svcDs.remove(i, ...svcIds).catch(
                (e) =>
                  void deleteLogger.warning({
                    message: 'Failed to remove service definitions during stack delete',
                    data: { stackName: id, error: e },
                  }),
              )
            }

            const repos = await repo
              .getDataSetFor(GitHubRepository, 'id')
              .find(i, { filter: { stackName: { $eq: id } }, select: ['id'] })
            const repoIds = repos.map((r) => r.id)
            if (repoIds.length > 0) {
              await repo
                .getDataSetFor(GitHubRepository, 'id')
                .remove(i, ...repoIds)
                .catch(
                  (e) =>
                    void deleteLogger.warning({
                      message: 'Failed to remove repositories during stack delete',
                      data: { stackName: id, error: e },
                    }),
                )
            }

            const prereqs = await repo
              .getDataSetFor(Prerequisite, 'id')
              .find(i, { filter: { stackName: { $eq: id } }, select: ['id'] })
            const prereqIds = prereqs.map((p) => p.id)
            if (prereqIds.length > 0) {
              await repo
                .getDataSetFor(Prerequisite, 'id')
                .remove(i, ...prereqIds)
                .catch(
                  (e) =>
                    void deleteLogger.warning({
                      message: 'Failed to remove prerequisites during stack delete',
                      data: { stackName: id, error: e },
                    }),
                )
            }

            await repo
              .getDataSetFor(StackConfig, 'stackName')
              .remove(i, id)
              .catch(
                (e) =>
                  void deleteLogger.warning({
                    message: 'Failed to remove stack config during stack delete',
                    data: { stackName: id, error: e },
                  }),
              )
            await repo.getDataSetFor(StackDefinition, 'name').remove(i, id)

            return JsonResult({})
          },
        ),
      },
    },
  })
}
