import { RequestError } from '@furystack/rest'
import { getRepository } from '@furystack/repository'
import { JsonResult, type RequestAction } from '@furystack/rest-service'
import type { ExportStackEndpoint } from 'common'
import { Dependency, GitHubRepository, Service, Stack } from 'common'

export const ExportStackAction: RequestAction<ExportStackEndpoint> = async ({ injector, getUrlParams }) => {
  const { id: stackName } = getUrlParams()
  const repository = getRepository(injector)

  const stackDs = repository.getDataSetFor(Stack, 'name')
  const stackResult = await stackDs.find(injector, { filter: { name: { $eq: stackName } }, top: 1 })
  const stack = stackResult[0]

  if (!stack) {
    throw new RequestError('Stack not found', 404)
  }

  const serviceDs = repository.getDataSetFor(Service, 'id')
  const repoDs = repository.getDataSetFor(GitHubRepository, 'id')
  const depDs = repository.getDataSetFor(Dependency, 'id')
  const services = await serviceDs.find(injector, { filter: { stackName: { $eq: stackName } } })
  const repositories = await repoDs.find(injector, { filter: { stackName: { $eq: stackName } } })
  const dependencies = await depDs.find(injector, { filter: { stackName: { $eq: stackName } } })

  return JsonResult({ stack, services, repositories, dependencies })
}
