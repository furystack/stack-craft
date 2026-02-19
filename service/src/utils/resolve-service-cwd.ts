import type { Injector } from '@furystack/inject'
import { getRepository } from '@furystack/repository'
import type { Service } from 'common'
import { GitHubRepository, Stack } from 'common'
import { getServiceCwd } from 'common'

import { useSystemIdentityContext } from '@furystack/core'
import { resolvePath } from './resolve-path.js'

/**
 * Resolves the absolute working directory for a service by looking up
 * the parent stack and (optional) linked repository.
 * When an existing elevated injector is provided, it will be reused
 * instead of creating (and disposing) a temporary one.
 */
export async function resolveServiceCwd(
  injector: Injector,
  service: Service,
  existingElevated?: Injector,
): Promise<string> {
  const elevated = existingElevated ?? useSystemIdentityContext({ injector })
  try {
    const repository = getRepository(elevated)
    const stacks = await repository.getDataSetFor(Stack, 'name').find(elevated, {
      filter: { name: { $eq: service.stackName } },
      top: 1,
    })
    const stack = stacks[0]
    if (!stack) throw new Error(`Stack not found: ${service.stackName}`)

    let repo: GitHubRepository | null = null
    if (service.repositoryId) {
      const repos = await repository.getDataSetFor(GitHubRepository, 'id').find(elevated, {
        filter: { id: { $eq: service.repositoryId } },
        top: 1,
      })
      repo = repos[0] ?? null
    }

    return resolvePath(getServiceCwd(stack, service, repo))
  } finally {
    if (!existingElevated) {
      await elevated[Symbol.asyncDispose]()
    }
  }
}
