import { RequestError } from '@furystack/rest'
import { JsonResult, type RequestAction } from '@furystack/rest-service'
import type { ExportStackEndpoint } from 'common'
import {
  detectSecretsInServiceDefinition,
  GitHubRepository,
  Prerequisite,
  ServiceDefinition,
  ServiceDependencyLink,
  ServicePrerequisiteLink,
  StackDefinition,
} from 'common'
import { legacyRepository as getRepository } from '../../../utils/legacy-repository.js'

export const ExportStackAction: RequestAction<ExportStackEndpoint> = async ({ injector, getUrlParams }) => {
  const { id: stackName } = getUrlParams()
  const repository = getRepository(injector)

  const stackDs = repository.getDataSetFor(StackDefinition, 'name')
  const stackResult = await stackDs.find(injector, { filter: { name: { $eq: stackName } }, top: 1 })
  const stack = stackResult[0]

  if (!stack) {
    throw new RequestError('Stack not found', 404)
  }

  const serviceDs = repository.getDataSetFor(ServiceDefinition, 'id')
  const repoDs = repository.getDataSetFor(GitHubRepository, 'id')
  const prereqDs = repository.getDataSetFor(Prerequisite, 'id')
  const services = await serviceDs.find(injector, { filter: { stackName: { $eq: stackName } } })
  const repositories = await repoDs.find(injector, { filter: { stackName: { $eq: stackName } } })
  const prerequisites = await prereqDs.find(injector, { filter: { stackName: { $eq: stackName } } })

  const prereqLinks = await repository.getDataSetFor(ServicePrerequisiteLink, 'id').find(injector, {})
  const depLinks = await repository.getDataSetFor(ServiceDependencyLink, 'id').find(injector, {})

  const prereqLinksByService = new Map<string, string[]>()
  for (const link of prereqLinks) {
    const ids = prereqLinksByService.get(link.serviceId) ?? []
    ids.push(link.prerequisiteId)
    prereqLinksByService.set(link.serviceId, ids)
  }
  const depLinksByService = new Map<string, string[]>()
  for (const link of depLinks) {
    const ids = depLinksByService.get(link.serviceId) ?? []
    ids.push(link.dependsOnServiceId)
    depLinksByService.set(link.serviceId, ids)
  }

  const stripTimestamps = <T extends { createdAt?: string; updatedAt?: string }>({
    createdAt: _c,
    updatedAt: _u,
    ...rest
  }: T) => rest

  // `stackName` is the same as `stack.name` for every child entity in this payload — emit it
  // once at the top level and reattach on import. See `ShareableServiceDefinition` etc.
  const stripChild = <T extends { createdAt?: string; updatedAt?: string; stackName?: string }>({
    createdAt: _c,
    updatedAt: _u,
    stackName: _s,
    ...rest
  }: T) => rest

  const stripNullish = <T extends Record<string, unknown>>(obj: T): T =>
    Object.fromEntries(Object.entries(obj).filter(([, v]) => v != null)) as T

  const warnings = services.flatMap((svc) =>
    detectSecretsInServiceDefinition({
      files: svc.files,
      runCommand: svc.runCommand,
      installCommand: svc.installCommand,
      buildCommand: svc.buildCommand,
    }).map((w) => ({ ...w, source: `${svc.displayName} > ${w.source}` })),
  )

  return JsonResult({
    stack: stripNullish(stripTimestamps(stack)),
    services: services.map((svc) => ({
      ...stripNullish(stripChild(svc)),
      prerequisiteIds: prereqLinksByService.get(svc.id) ?? [],
      prerequisiteServiceIds: depLinksByService.get(svc.id) ?? [],
    })),
    repositories: repositories.map((r) => stripNullish(stripChild(r))),
    prerequisites: prerequisites.map((p) => stripNullish(stripChild(p))),
    ...(warnings.length > 0 ? { warnings } : {}),
  })
}
