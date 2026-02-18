import { getLogger } from '@furystack/logging'
import { getRepository } from '@furystack/repository'
import { RequestError } from '@furystack/rest'
import { JsonResult, type RequestAction } from '@furystack/rest-service'
import type { ImportStackEndpoint } from 'common'
import { Dependency, GitHubRepository, Service, Stack } from 'common'

export const ImportStackAction: RequestAction<ImportStackEndpoint> = async ({ injector, getBody }) => {
  const logger = getLogger(injector).withScope('ImportStack')
  const body = await getBody()
  const repository = getRepository(injector)

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

  const stackDs = repository.getDataSetFor(Stack, 'name')
  const repoDs = repository.getDataSetFor(GitHubRepository, 'id')
  const depDs = repository.getDataSetFor(Dependency, 'id')
  const serviceDs = repository.getDataSetFor(Service, 'id')

  try {
    await stackDs.add(injector, { ...body.stack, createdAt: now, updatedAt: now })
    await repoDs.add(injector, ...repositories)
    await depDs.add(injector, ...dependencies)
    await serviceDs.add(injector, ...services)
  } catch (error) {
    await logger.warning({ message: `Import failed for stack ${stackName}, rolling back`, data: { error } })

    for (const svc of services) {
      await serviceDs.remove(injector, svc.id).catch(() => {})
    }
    for (const dep of dependencies) {
      await depDs.remove(injector, dep.id).catch(() => {})
    }
    for (const repo of repositories) {
      await repoDs.remove(injector, repo.id).catch(() => {})
    }
    await stackDs.remove(injector, stackName).catch(() => {})

    const message = error instanceof Error ? error.message : 'Unknown error during import'
    throw new RequestError(`Import failed: ${message}`, 500)
  }

  await logger.information({ message: `Stack imported successfully: ${stackName}` })
  return JsonResult({ success: true })
}
