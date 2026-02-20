import { describe, expect, it } from 'vitest'

import { getRepoNameFromUrl, getServiceCwd } from './service-path-utils.js'
import type { GitHubRepository } from '../models/index.js'

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
    const config = { mainDirectory: '/workspace/stacks/my-stack' }

    it('should join stack root with service path and repo name when repo is linked', () => {
      const service = { workingDirectory: 'frontends/public' }
      const repo: GitHubRepository = {
        id: 'repo-1',
        stackName: 'my-stack',
        url: 'https://github.com/org/my-frontend.git',
        displayName: 'My Frontend',
        description: '',
        createdAt: '',
        updatedAt: '',
      }
      expect(getServiceCwd(config, service, repo)).toBe('/workspace/stacks/my-stack/frontends/public/my-frontend')
    })

    it('should use stack root when service has no workingDirectory and no repo', () => {
      const service = {}
      expect(getServiceCwd(config, service, null)).toBe('/workspace/stacks/my-stack')
    })

    it('should use stack root + service path when no repo', () => {
      const service = { workingDirectory: 'services/gateway' }
      expect(getServiceCwd(config, service, null)).toBe('/workspace/stacks/my-stack/services/gateway')
    })
  })
})
