import { getStoreManager } from '@furystack/core'
import type { Injector } from '@furystack/inject'
import type { Service } from 'common'
import { GitHubRepository, Stack } from 'common'
import { getServiceCwd } from 'common'
import { resolvePath } from './resolve-path.js'

/**
 * Resolves the absolute working directory for a service by looking up
 * the parent stack and (optional) linked repository.
 */
export async function resolveServiceCwd(injector: Injector, service: Service): Promise<string> {
  const sm = getStoreManager(injector)
  const stacks = await sm.getStoreFor(Stack, 'name').find({
    filter: { name: { $eq: service.stackName } },
    top: 1,
  })
  const stack = stacks[0]
  if (!stack) throw new Error(`Stack not found: ${service.stackName}`)

  let repo: GitHubRepository | null = null
  if (service.repositoryId) {
    const repos = await sm.getStoreFor(GitHubRepository, 'id').find({
      filter: { id: { $eq: service.repositoryId } },
      top: 1,
    })
    repo = repos[0] ?? null
  }

  return resolvePath(getServiceCwd(stack, service, repo))
}
