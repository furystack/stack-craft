import type { Injector } from '@furystack/inject'
import { getLogger } from '@furystack/logging'
import { RequestError } from '@furystack/rest'
import { ServiceConfig, ServiceDefinition, ServiceDependencyLink, ServicePrerequisiteLink, ServiceStatus } from 'common'

import { legacyRepository as getRepository } from '../../../utils/legacy-repository.js'
import type { ServiceArtifacts } from './service-artifacts.js'

/**
 * Persists the four service rows + link rows in dependency order. If any
 * insert throws, every record already written for the service is removed
 * before the error is re-thrown — so a failed create never leaves orphan
 * rows behind. Errors that are not already a {@link RequestError} are
 * wrapped into a 500 with the original message preserved.
 *
 * Insertion order: def → config → status → prereq links → dep links. Rollback
 * walks the inverse, with link rows discovered via filtered `find` (link
 * primary keys are composite strings, not the service id).
 */
export const createServiceWithRollback = async (injector: Injector, artifacts: ServiceArtifacts): Promise<void> => {
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
