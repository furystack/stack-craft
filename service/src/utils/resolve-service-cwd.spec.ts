import { resolve } from 'path'
import { getRepository } from '@furystack/repository'
import type { ServiceDefinition } from 'common'
import { GitHubRepository, StackConfig } from 'common'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { createTestInjector } from '../test-helpers.js'
import { resolveServiceCwd } from './resolve-service-cwd.js'

const ts = new Date().toISOString()

describe('resolveServiceCwd', () => {
  let injector: ReturnType<typeof createTestInjector>['injector']
  let elevated: ReturnType<typeof createTestInjector>['elevated']

  beforeEach(() => {
    ;({ injector, elevated } = createTestInjector())
  })

  afterEach(async () => {
    await injector[Symbol.asyncDispose]()
  })

  const addStackConfig = async (stackName: string, mainDirectory: string) => {
    await getRepository(elevated)
      .getDataSetFor(StackConfig, 'stackName')
      .add(elevated, {
        stackName,
        mainDirectory,
        environmentVariables: {},
        createdAt: ts,
        updatedAt: ts,
      } as StackConfig)
  }

  const addRepo = async (id: string, stackName: string, url: string) => {
    await getRepository(elevated)
      .getDataSetFor(GitHubRepository, 'id')
      .add(elevated, {
        id,
        stackName,
        url,
        displayName: id,
        description: '',
      } as GitHubRepository)
  }

  it('should resolve cwd from stack mainDirectory when no workingDirectory or repo', async () => {
    await addStackConfig('my-stack', '/tmp/stacks')
    const service = { stackName: 'my-stack', id: 'svc-1' } as ServiceDefinition

    const result = await resolveServiceCwd(injector, service, elevated)

    expect(result).toBe(resolve('/tmp/stacks'))
  })

  it('should include service workingDirectory in the resolved path', async () => {
    await addStackConfig('my-stack', '/tmp/stacks')
    const service = {
      stackName: 'my-stack',
      id: 'svc-2',
      workingDirectory: 'services/frontend',
    } as ServiceDefinition

    const result = await resolveServiceCwd(injector, service, elevated)

    expect(result).toBe(resolve('/tmp/stacks/services/frontend'))
  })

  it('should append repo name when service has a repositoryId', async () => {
    await addStackConfig('my-stack', '/tmp/stacks')
    await addRepo('repo-1', 'my-stack', 'https://github.com/user/my-repo')
    const service = {
      stackName: 'my-stack',
      id: 'svc-3',
      repositoryId: 'repo-1',
    } as ServiceDefinition

    const result = await resolveServiceCwd(injector, service, elevated)

    expect(result).toBe(resolve('/tmp/stacks/my-repo'))
  })

  it('should append repo name after workingDirectory', async () => {
    await addStackConfig('my-stack', '/tmp/stacks')
    await addRepo('repo-1', 'my-stack', 'https://github.com/user/my-repo.git')
    const service = {
      stackName: 'my-stack',
      id: 'svc-4',
      workingDirectory: 'apps',
      repositoryId: 'repo-1',
    } as ServiceDefinition

    const result = await resolveServiceCwd(injector, service, elevated)

    expect(result).toBe(resolve('/tmp/stacks/apps/my-repo'))
  })

  it('should throw when stack config is not found', async () => {
    const service = { stackName: 'nonexistent', id: 'svc-5' } as ServiceDefinition

    await expect(resolveServiceCwd(injector, service, elevated)).rejects.toThrow('Stack config not found: nonexistent')
  })

  it('should work without an existing elevated injector', async () => {
    await addStackConfig('my-stack', '/tmp/stacks')
    const service = { stackName: 'my-stack', id: 'svc-6' } as ServiceDefinition

    const result = await resolveServiceCwd(injector, service)

    expect(result).toBe(resolve('/tmp/stacks'))
  })

  it('should not dispose the provided elevated injector', async () => {
    await addStackConfig('my-stack', '/tmp/stacks')
    const service = { stackName: 'my-stack', id: 'svc-7' } as ServiceDefinition

    await resolveServiceCwd(injector, service, elevated)

    const configs = await getRepository(elevated).getDataSetFor(StackConfig, 'stackName').find(elevated, {})
    expect(configs).toHaveLength(1)
  })

  it('should ignore repositoryId when the repository does not exist', async () => {
    await addStackConfig('my-stack', '/tmp/stacks')
    const service = {
      stackName: 'my-stack',
      id: 'svc-8',
      repositoryId: 'nonexistent-repo',
    } as ServiceDefinition

    const result = await resolveServiceCwd(injector, service, elevated)

    expect(result).toBe(resolve('/tmp/stacks'))
  })
})
