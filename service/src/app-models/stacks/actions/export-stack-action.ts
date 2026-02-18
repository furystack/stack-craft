import { getStoreManager } from '@furystack/core'
import { RequestError } from '@furystack/rest'
import { JsonResult, type RequestAction } from '@furystack/rest-service'
import type { ExportStackEndpoint } from 'common'
import { Dependency, GitHubRepository, Service, Stack } from 'common'

export const ExportStackAction: RequestAction<ExportStackEndpoint> = async ({ injector, getUrlParams }) => {
  const { id: stackName } = getUrlParams()
  const sm = getStoreManager(injector)

  const stackStore = sm.getStoreFor(Stack, 'name')
  const stackResult = await stackStore.find({ filter: { name: { $eq: stackName } }, top: 1 })
  const stack = stackResult[0]

  if (!stack) {
    throw new RequestError('Stack not found', 404)
  }

  const services = await sm.getStoreFor(Service, 'id').find({ filter: { stackName: { $eq: stackName } } })
  const repositories = await sm.getStoreFor(GitHubRepository, 'id').find({ filter: { stackName: { $eq: stackName } } })
  const dependencies = await sm.getStoreFor(Dependency, 'id').find({ filter: { stackName: { $eq: stackName } } })

  return JsonResult({ stack, services, repositories, dependencies })
}
