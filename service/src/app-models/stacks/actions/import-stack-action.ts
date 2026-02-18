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

  const repositories = body.repositories.map((repo) => ({
    ...repo,
    stackName,
    createdAt: now,
    updatedAt: now,
  }))

  const dependencies = body.dependencies.map((dep) => ({
    ...dep,
    stackName,
    createdAt: now,
    updatedAt: now,
  }))

  const services = body.services.map((svc) => ({
    ...svc,
    stackName,
    installStatus: 'not-installed' as const,
    buildStatus: 'not-built' as const,
    runStatus: 'stopped' as const,
    createdAt: now,
    updatedAt: now,
  }))

  try {
    await sm.getStoreFor(Stack, 'name').add({ ...body.stack, createdAt: now, updatedAt: now })
    await sm.getStoreFor(GitHubRepository, 'id').add(...repositories)
    await sm.getStoreFor(Dependency, 'id').add(...dependencies)
    await sm.getStoreFor(Service, 'id').add(...services)
  } catch (error) {
    await logger.warning({ message: `Import failed for stack ${stackName}, rolling back`, data: { error } })

    for (const svc of services) {
      await sm
        .getStoreFor(Service, 'id')
        .remove(svc.id)
        .catch(() => {})
    }
    for (const dep of dependencies) {
      await sm
        .getStoreFor(Dependency, 'id')
        .remove(dep.id)
        .catch(() => {})
    }
    for (const repo of repositories) {
      await sm
        .getStoreFor(GitHubRepository, 'id')
        .remove(repo.id)
        .catch(() => {})
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
