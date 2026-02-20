import type { Injector } from '@furystack/inject'
import { getRepository } from '@furystack/repository'
import type { ServiceDefinition } from 'common'
import { GitHubRepository, StackConfig } from 'common'
import { getServiceCwd } from 'common'

import { useSystemIdentityContext } from '@furystack/core'
import { resolvePath } from './resolve-path.js'

/**
 * Resolves the absolute working directory for a service by looking up
 * the parent stack config and (optional) linked repository.
 * When an existing elevated injector is provided, it will be reused
 * instead of creating (and disposing) a temporary one.
 */
export async function resolveServiceCwd(
  injector: Injector,
  service: ServiceDefinition,
  existingElevated?: Injector,
): Promise<string> {
  const elevated = existingElevated ?? useSystemIdentityContext({ injector })
  try {
    const repository = getRepository(elevated)
    const configs = await repository.getDataSetFor(StackConfig, 'stackName').find(elevated, {
      filter: { stackName: { $eq: service.stackName } },
      top: 1,
    })
    const config = configs[0]
    if (!config) throw new Error(`Stack config not found: ${service.stackName}`)

    let repo: GitHubRepository | null = null
    if (service.repositoryId) {
      const repos = await repository.getDataSetFor(GitHubRepository, 'id').find(elevated, {
        filter: { id: { $eq: service.repositoryId } },
        top: 1,
      })
      repo = repos[0] ?? null
    }

    return resolvePath(getServiceCwd(config, service, repo))
  } finally {
    if (!existingElevated) {
      await elevated[Symbol.asyncDispose]()
    }
  }
}
