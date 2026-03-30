import { getLogger } from '@furystack/logging'
import { getRepository } from '@furystack/repository'
import { RequestError } from '@furystack/rest'
import { JsonResult, type RequestAction } from '@furystack/rest-service'
import type { ImportStackEndpoint } from 'common'
import {
  GitHubRepository,
  Prerequisite,
  ServiceConfig,
  ServiceDefinition,
  ServiceDependencyLink,
  ServicePrerequisiteLink,
  ServiceStateHistory,
  ServiceStatus,
  StackConfig,
  StackDefinition,
} from 'common'

import { CryptoService } from '../../../utils/crypto-service.js'
import { encryptEnvValues, encryptLocalFiles } from '../../../utils/env-encryption-helpers.js'
import { detectSecretsInServiceDefinition } from '../../../utils/secret-detector.js'

export const ImportStackAction: RequestAction<ImportStackEndpoint> = async ({ injector, getBody }) => {
  const logger = getLogger(injector).withScope('ImportStack')
  const body = await getBody()
  const repository = getRepository(injector)

  const now = new Date().toISOString()
  const stackName = body.stack.name

  await logger.information({ message: `Importing stack: ${stackName}` })

  const stackDefDs = repository.getDataSetFor(StackDefinition, 'name')
  const stackConfigDs = repository.getDataSetFor(StackConfig, 'stackName')
  const repoDs = repository.getDataSetFor(GitHubRepository, 'id')
  const prereqDs = repository.getDataSetFor(Prerequisite, 'id')
  const svcDefDs = repository.getDataSetFor(ServiceDefinition, 'id')
  const svcConfigDs = repository.getDataSetFor(ServiceConfig, 'serviceId')
  const svcStatusDs = repository.getDataSetFor(ServiceStatus, 'serviceId')
  const historyDs = repository.getDataSetFor(ServiceStateHistory, 'id')
  const prereqLinkDs = repository.getDataSetFor(ServicePrerequisiteLink, 'id')
  const depLinkDs = repository.getDataSetFor(ServiceDependencyLink, 'id')

  const repositories = body.repositories.map((repo) => ({
    ...repo,
    stackName,
    createdAt: now,
    updatedAt: now,
  }))

  const prerequisites = body.prerequisites.map((prereq) => ({
    ...prereq,
    stackName,
    createdAt: now,
    updatedAt: now,
  }))

  const serviceDefinitions = body.services.map(({ prerequisiteIds: _p, prerequisiteServiceIds: _ps, ...svc }) => ({
    ...svc,
    stackName,
    createdAt: now,
    updatedAt: now,
  }))

  try {
    await stackDefDs.add(injector, {
      ...body.stack,
      createdAt: now,
      updatedAt: now,
    })

    const crypto = injector.getInstance(CryptoService)
    await stackConfigDs.add(injector, {
      stackName,
      mainDirectory: body.config.mainDirectory,
      environmentVariables: encryptEnvValues(crypto, body.config.environmentVariables ?? {}),
      createdAt: now,
      updatedAt: now,
    })

    if (repositories.length > 0) {
      await repoDs.add(injector, ...repositories)
    }
    if (prerequisites.length > 0) {
      await prereqDs.add(injector, ...prerequisites)
    }
    if (serviceDefinitions.length > 0) {
      await svcDefDs.add(injector, ...serviceDefinitions)
    }

    for (const svc of body.services) {
      for (const prereqId of svc.prerequisiteIds ?? []) {
        await prereqLinkDs.add(injector, { id: `${svc.id}::${prereqId}`, serviceId: svc.id, prerequisiteId: prereqId })
      }
      for (const depId of svc.prerequisiteServiceIds ?? []) {
        await depLinkDs.add(injector, { id: `${svc.id}::${depId}`, serviceId: svc.id, dependsOnServiceId: depId })
      }
    }

    for (const svcDef of serviceDefinitions) {
      const userConfig = body.config.services?.[svcDef.id]
      await svcConfigDs.add(injector, {
        serviceId: svcDef.id,
        autoFetchEnabled: userConfig?.autoFetchEnabled ?? false,
        autoFetchIntervalMinutes: userConfig?.autoFetchIntervalMinutes ?? 60,
        autoRestartOnFetch: userConfig?.autoRestartOnFetch ?? false,
        environmentVariableOverrides: encryptEnvValues(crypto, userConfig?.environmentVariableOverrides ?? {}),
        localFiles: encryptLocalFiles(crypto, userConfig?.localFiles ?? []),
        createdAt: now,
        updatedAt: now,
      })

      await svcStatusDs.add(injector, {
        serviceId: svcDef.id,
        cloneStatus: 'not-cloned',
        installStatus: 'not-installed',
        buildStatus: 'not-built',
        runStatus: 'stopped',
        updatedAt: now,
      })

      await historyDs.add(injector, {
        serviceId: svcDef.id,
        event: 'imported',
        newState: JSON.stringify({
          cloneStatus: 'not-cloned',
          installStatus: 'not-installed',
          buildStatus: 'not-built',
          runStatus: 'stopped',
        }),
        triggeredBy: 'system',
        triggerSource: 'system',
        metadata: JSON.stringify({ action: 'import', stackName }),
        createdAt: now,
      })
    }
  } catch (error) {
    await logger.warning({ message: `Import failed for stack ${stackName}, rolling back`, data: { error } })

    // Best-effort rollback: ignore individual removal failures
    const svcIds = serviceDefinitions.map((s) => s.id)
    for (const svcId of svcIds) {
      const historyEntries = await historyDs
        .find(injector, { filter: { serviceId: { $eq: svcId } } })
        .catch(() => [] as ServiceStateHistory[])
      if (historyEntries.length > 0) {
        await historyDs.remove(injector, ...historyEntries.map((e) => e.id)).catch(
          (e) =>
            void logger.warning({
              message: 'Rollback: failed to remove history entries',
              data: { stackName, error: e },
            }),
        )
      }
    }
    for (const svcId of svcIds) {
      const pLinks = await prereqLinkDs
        .find(injector, { filter: { serviceId: { $eq: svcId } } })
        .catch(() => [] as ServicePrerequisiteLink[])
      if (pLinks.length > 0) {
        await prereqLinkDs.remove(injector, ...pLinks.map((l) => l.id)).catch(() => undefined)
      }
      const dLinks = await depLinkDs
        .find(injector, { filter: { serviceId: { $eq: svcId } } })
        .catch(() => [] as ServiceDependencyLink[])
      if (dLinks.length > 0) {
        await depLinkDs.remove(injector, ...dLinks.map((l) => l.id)).catch(() => undefined)
      }
    }
    if (svcIds.length > 0) {
      await svcStatusDs.remove(injector, ...svcIds).catch(
        (e) =>
          void logger.warning({
            message: 'Rollback: failed to remove service statuses',
            data: { stackName, error: e },
          }),
      )
      await svcConfigDs.remove(injector, ...svcIds).catch(
        (e) =>
          void logger.warning({
            message: 'Rollback: failed to remove service configs',
            data: { stackName, error: e },
          }),
      )
      await svcDefDs.remove(injector, ...svcIds).catch(
        (e) =>
          void logger.warning({
            message: 'Rollback: failed to remove service definitions',
            data: { stackName, error: e },
          }),
      )
    }
    if (prerequisites.length > 0) {
      await prereqDs
        .remove(injector, ...prerequisites.map((p) => p.id))
        .catch(
          (e) =>
            void logger.warning({ message: 'Rollback: failed to remove prerequisites', data: { stackName, error: e } }),
        )
    }
    if (repositories.length > 0) {
      await repoDs
        .remove(injector, ...repositories.map((r) => r.id))
        .catch(
          (e) =>
            void logger.warning({ message: 'Rollback: failed to remove repositories', data: { stackName, error: e } }),
        )
    }
    await stackConfigDs
      .remove(injector, stackName)
      .catch(
        (e) =>
          void logger.warning({ message: 'Rollback: failed to remove stack config', data: { stackName, error: e } }),
      )
    await stackDefDs.remove(injector, stackName).catch(
      (e) =>
        void logger.warning({
          message: 'Rollback: failed to remove stack definition',
          data: { stackName, error: e },
        }),
    )

    const message = error instanceof Error ? error.message : 'Unknown error during import'
    throw new RequestError(`Import failed: ${message}`, 500)
  }

  const warnings = body.services.flatMap((svc) =>
    detectSecretsInServiceDefinition({
      files: svc.files,
      runCommand: svc.runCommand,
      installCommand: svc.installCommand,
      buildCommand: svc.buildCommand,
    }).map((w) => ({ ...w, source: `${svc.displayName} > ${w.source}` })),
  )

  await logger.information({ message: `Stack imported successfully: ${stackName}` })
  return JsonResult({ success: true, ...(warnings.length > 0 ? { warnings } : {}) })
}
