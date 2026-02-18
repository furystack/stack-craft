import { describe, expect, it } from 'vitest'

import { getRepoNameFromUrl, getServiceCwd } from './service-path-utils.js'
import type { GitHubRepository, Service, Stack } from '../models/index.js'

describe('service-path-utils', () => {
  describe('getRepoNameFromUrl', () => {
    it('should extract repo name from .git URL', () => {
      expect(getRepoNameFromUrl('https://github.com/user/my-repo.git')).toBe('my-repo')
    })

    it('should extract repo name from URL without .git', () => {
      expect(getRepoNameFromUrl('https://github.com/user/my-repo')).toBe('my-repo')
    })

    it('should return "repo" for malformed URL', () => {
      expect(getRepoNameFromUrl('invalid')).toBe('repo')
    })
  })

  describe('getServiceCwd', () => {
    const stack: Stack = {
      name: 'my-stack',
      displayName: 'My Stack',
      description: '',
      mainDirectory: '/workspace/stacks/my-stack',
      createdAt: '',
      updatedAt: '',
    }

    it('should join stack root with service path and repo name when repo is linked', () => {
      const service: Service = {
        id: 'svc-1',
        stackName: 'my-stack',
        displayName: 'Frontend',
        description: '',
        workingDirectory: 'frontends/public',
        repositoryId: 'repo-1',
        runCommand: 'npm start',
        installStatus: 'not-installed',
        buildStatus: 'not-built',
        runStatus: 'stopped',
        autoFetchEnabled: false,
        autoFetchIntervalMinutes: 60,
        autoRestartOnFetch: false,
        dependencyIds: [],
        prerequisiteServiceIds: [],
        createdAt: '',
        updatedAt: '',
      }
      const repo: GitHubRepository = {
        id: 'repo-1',
        stackName: 'my-stack',
        url: 'https://github.com/org/my-frontend.git',
        displayName: 'My Frontend',
        description: '',
        createdAt: '',
        updatedAt: '',
      }
      expect(getServiceCwd(stack, service, repo)).toBe('/workspace/stacks/my-stack/frontends/public/my-frontend')
    })

    it('should use stack root when service has no workingDirectory and no repo', () => {
      const service: Service = {
        id: 'svc-1',
        stackName: 'my-stack',
        displayName: 'Service',
        description: '',
        runCommand: 'echo hi',
        installStatus: 'not-installed',
        buildStatus: 'not-built',
        runStatus: 'stopped',
        autoFetchEnabled: false,
        autoFetchIntervalMinutes: 60,
        autoRestartOnFetch: false,
        dependencyIds: [],
        prerequisiteServiceIds: [],
        createdAt: '',
        updatedAt: '',
      }
      expect(getServiceCwd(stack, service, null)).toBe('/workspace/stacks/my-stack')
    })

    it('should use stack root + service path when no repo', () => {
      const service: Service = {
        id: 'svc-1',
        stackName: 'my-stack',
        displayName: 'Service',
        description: '',
        workingDirectory: 'services/gateway',
        runCommand: 'echo hi',
        installStatus: 'not-installed',
        buildStatus: 'not-built',
        runStatus: 'stopped',
        autoFetchEnabled: false,
        autoFetchIntervalMinutes: 60,
        autoRestartOnFetch: false,
        dependencyIds: [],
        prerequisiteServiceIds: [],
        createdAt: '',
        updatedAt: '',
      }
      expect(getServiceCwd(stack, service, null)).toBe('/workspace/stacks/my-stack/services/gateway')
    })
  })
})
