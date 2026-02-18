import { getStoreManager } from '@furystack/core'
import { getLogger } from '@furystack/logging'
import { RequestError } from '@furystack/rest'
import { JsonResult, type RequestAction } from '@furystack/rest-service'
import type { ImportStackEndpoint } from 'common'
import { Dependency, GitHubRepository, Service, Stack } from 'common'

export const ImportStackAction: RequestAction<ImportStackEndpoint> = async ({ injector, getBody }) => {
  const logger = getLogger(injector).withScope('ImportStack')
  const body = await getBody()
  const sm = getStoreManager(injector)

  const now = new Date().toISOString()
  const stackName = body.stack.name

  await logger.information({ message: `Importing stack: ${stackName}` })

  const addedRepoIds: string[] = []
  const addedDepIds: string[] = []
  const addedServiceIds: string[] = []

  try {
    const stackStore = sm.getStoreFor(Stack, 'name')
    await stackStore.add({ ...body.stack, createdAt: now, updatedAt: now })

    const repoStore = sm.getStoreFor(GitHubRepository, 'id')
    for (const repo of body.repositories) {
      await repoStore.add({ ...repo, stackName, createdAt: now, updatedAt: now })
      addedRepoIds.push(repo.id)
    }

    const depStore = sm.getStoreFor(Dependency, 'id')
    for (const dep of body.dependencies) {
      await depStore.add({ ...dep, stackName, createdAt: now, updatedAt: now })
      addedDepIds.push(dep.id)
    }

    const serviceStore = sm.getStoreFor(Service, 'id')
    for (const svc of body.services) {
      await serviceStore.add({
        ...svc,
        stackName,
        installStatus: 'not-installed',
        buildStatus: 'not-built',
        runStatus: 'stopped',
        createdAt: now,
        updatedAt: now,
      })
      addedServiceIds.push(svc.id)
    }
  } catch (error) {
    await logger.warning({ message: `Import failed for stack ${stackName}, rolling back`, data: { error } })

    for (const id of addedServiceIds) {
      await sm.getStoreFor(Service, 'id').remove(id).catch(() => {})
    }
    for (const id of addedDepIds) {
      await sm.getStoreFor(Dependency, 'id').remove(id).catch(() => {})
    }
    for (const id of addedRepoIds) {
      await sm.getStoreFor(GitHubRepository, 'id').remove(id).catch(() => {})
    }
    await sm
      .getStoreFor(Stack, 'name')
      .remove(stackName)
      .catch(() => {})

    const message = error instanceof Error ? error.message : 'Unknown error during import'
    throw new RequestError(`Import failed: ${message}`, 500)
  }

  await logger.information({ message: `Stack imported successfully: ${stackName}` })
  return JsonResult({ success: true })
}
