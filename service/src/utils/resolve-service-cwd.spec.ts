import { GitHubRepositoryDataSet, StackConfigDataSet } from '../app-models/data-store/tokens.js'
import { getDataSetFor } from '@furystack/repository'
import { tmpdir } from 'os'
import { join, resolve } from 'path'
import type { Injector } from '@furystack/inject'
import type { ServiceDefinition } from 'common'
import type { GitHubRepository } from 'common'
import { describe, expect, it } from 'vitest'
import { withTestInjector } from '../test-helpers.js'
import { resolveServiceCwd } from './resolve-service-cwd.js'
const ts = new Date().toISOString()
const STACKS_DIR = join(tmpdir(), 'stacks')

describe('resolveServiceCwd', () => {
  const addStackConfig = async (elevated: Injector, stackName: string, mainDirectory: string) => {
    await getDataSetFor(elevated, StackConfigDataSet).add(elevated, {
      stackName,
      mainDirectory,
      environmentVariables: {},
      createdAt: ts,
      updatedAt: ts,
    })
  }

  const addRepo = async (elevated: Injector, id: string, stackName: string, url: string) => {
    await getDataSetFor(elevated, GitHubRepositoryDataSet).add(elevated, {
      id,
      stackName,
      url,
      displayName: id,
      description: '',
    } as GitHubRepository)
  }

  it('should resolve cwd from stack mainDirectory when no workingDirectory or repo', () =>
    withTestInjector(async ({ injector, elevated }) => {
      await addStackConfig(elevated, 'my-stack', STACKS_DIR)
      const service = { stackName: 'my-stack', id: 'svc-1' } as ServiceDefinition

      const result = await resolveServiceCwd(injector, service, elevated)

      expect(result).toBe(resolve(STACKS_DIR))
    }))

  it('should include service workingDirectory in the resolved path', () =>
    withTestInjector(async ({ injector, elevated }) => {
      await addStackConfig(elevated, 'my-stack', STACKS_DIR)
      const service = {
        stackName: 'my-stack',
        id: 'svc-2',
        workingDirectory: 'services/frontend',
      } as ServiceDefinition

      const result = await resolveServiceCwd(injector, service, elevated)

      expect(result).toBe(resolve(STACKS_DIR, 'services/frontend'))
    }))

  it('should append repo name when service has a repositoryId', () =>
    withTestInjector(async ({ injector, elevated }) => {
      await addStackConfig(elevated, 'my-stack', STACKS_DIR)
      await addRepo(elevated, 'repo-1', 'my-stack', 'https://github.com/user/my-repo')
      const service = {
        stackName: 'my-stack',
        id: 'svc-3',
        repositoryId: 'repo-1',
      } as ServiceDefinition

      const result = await resolveServiceCwd(injector, service, elevated)

      expect(result).toBe(resolve(STACKS_DIR, 'my-repo'))
    }))

  it('should append repo name after workingDirectory', () =>
    withTestInjector(async ({ injector, elevated }) => {
      await addStackConfig(elevated, 'my-stack', STACKS_DIR)
      await addRepo(elevated, 'repo-1', 'my-stack', 'https://github.com/user/my-repo.git')
      const service = {
        stackName: 'my-stack',
        id: 'svc-4',
        workingDirectory: 'apps',
        repositoryId: 'repo-1',
      } as ServiceDefinition

      const result = await resolveServiceCwd(injector, service, elevated)

      expect(result).toBe(resolve(STACKS_DIR, 'apps/my-repo'))
    }))

  it('should throw when stack config is not found', () =>
    withTestInjector(async ({ injector, elevated }) => {
      const service = { stackName: 'nonexistent', id: 'svc-5' } as ServiceDefinition

      await expect(resolveServiceCwd(injector, service, elevated)).rejects.toThrow(
        'Stack config not found: nonexistent',
      )
    }))

  it('should work without an existing elevated injector', () =>
    withTestInjector(async ({ injector, elevated }) => {
      await addStackConfig(elevated, 'my-stack', STACKS_DIR)
      const service = { stackName: 'my-stack', id: 'svc-6' } as ServiceDefinition

      const result = await resolveServiceCwd(injector, service)

      expect(result).toBe(resolve(STACKS_DIR))
    }))

  it('should not dispose the provided elevated injector', () =>
    withTestInjector(async ({ injector, elevated }) => {
      await addStackConfig(elevated, 'my-stack', STACKS_DIR)
      const service = { stackName: 'my-stack', id: 'svc-7' } as ServiceDefinition

      await resolveServiceCwd(injector, service, elevated)

      const configs = await getDataSetFor(elevated, StackConfigDataSet).find(elevated, {})
      expect(configs).toHaveLength(1)
    }))

  it('should ignore repositoryId when the repository does not exist', () =>
    withTestInjector(async ({ injector, elevated }) => {
      await addStackConfig(elevated, 'my-stack', STACKS_DIR)
      const service = {
        stackName: 'my-stack',
        id: 'svc-8',
        repositoryId: 'nonexistent-repo',
      } as ServiceDefinition

      const result = await resolveServiceCwd(injector, service, elevated)

      expect(result).toBe(resolve(STACKS_DIR))
    }))
})
