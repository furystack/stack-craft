import { RequestError } from '@furystack/rest'
import { getRepository } from '@furystack/repository'
import { JsonResult, type RequestAction } from '@furystack/rest-service'
import type { ExportStackEndpoint } from 'common'
import { GitHubRepository, Prerequisite, ServiceDefinition, StackDefinition } from 'common'

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

  const stripTimestamps = <T extends { createdAt?: string; updatedAt?: string }>({
    createdAt: _c,
    updatedAt: _u,
    ...rest
  }: T) => rest

  return JsonResult({
    stack: stripTimestamps(stack),
    services: services.map(stripTimestamps),
    repositories: repositories.map(stripTimestamps),
    prerequisites: prerequisites.map(stripTimestamps),
  })
}
