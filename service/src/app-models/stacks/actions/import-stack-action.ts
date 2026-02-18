import { getStoreManager } from '@furystack/core'
import { getLogger } from '@furystack/logging'
import { JsonResult, type RequestAction } from '@furystack/rest-service'
import type { ImportStackEndpoint } from 'common'
import { Dependency, GitHubRepository, Service, Stack } from 'common'

export const ImportStackAction: RequestAction<ImportStackEndpoint> = async ({ injector, getBody }) => {
  const logger = getLogger(injector).withScope('ImportStack')
  const body = await getBody()
  const sm = getStoreManager(injector)

  const now = new Date().toISOString()

  await logger.information({ message: `Importing stack: ${body.stack.name}` })

  const stackStore = sm.getStoreFor(Stack, 'name')
  await stackStore.add({ ...body.stack, createdAt: now, updatedAt: now })

  const repoStore = sm.getStoreFor(GitHubRepository, 'id')
  for (const repo of body.repositories) {
    await repoStore.add({ ...repo, stackName: body.stack.name, createdAt: now, updatedAt: now })
  }

  const depStore = sm.getStoreFor(Dependency, 'id')
  for (const dep of body.dependencies) {
    await depStore.add({ ...dep, stackName: body.stack.name, createdAt: now, updatedAt: now })
  }

  const serviceStore = sm.getStoreFor(Service, 'id')
  for (const svc of body.services) {
    await serviceStore.add({
      ...svc,
      stackName: body.stack.name,
      installStatus: 'not-installed',
      buildStatus: 'not-built',
      runStatus: 'stopped',
      createdAt: now,
      updatedAt: now,
    })
  }

  await logger.information({ message: `Stack imported successfully: ${body.stack.name}` })
  return JsonResult({ success: true })
}
