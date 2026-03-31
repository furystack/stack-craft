import { describe, expect, it, vi } from 'vitest'

vi.mock('../app-routes.js', () => ({}))

import { isGitHubRepoFormPayload } from './github-repo-form.js'

describe('isGitHubRepoFormPayload', () => {
  const validPayload = {
    url: 'https://github.com/org/repo',
    displayName: 'My Repo',
    description: 'A GitHub repository',
  }

  it('should accept a valid payload', () => {
    expect(isGitHubRepoFormPayload(validPayload)).toBe(true)
  })

  it('should accept payload without description (not validated)', () => {
    expect(isGitHubRepoFormPayload({ url: 'https://github.com/a/b', displayName: 'R' })).toBe(true)
  })

  it('should throw on null (no null guard)', () => {
    expect(() => isGitHubRepoFormPayload(null)).toThrow()
  })

  it('should throw on undefined (no null guard)', () => {
    expect(() => isGitHubRepoFormPayload(undefined)).toThrow()
  })

  it('should reject when url is missing', () => {
    expect(isGitHubRepoFormPayload({ displayName: 'R' })).toBe(false)
  })

  it('should reject when url is empty', () => {
    expect(isGitHubRepoFormPayload({ ...validPayload, url: '' })).toBe(false)
  })

  it('should reject when displayName is missing', () => {
    expect(isGitHubRepoFormPayload({ url: 'https://github.com/a/b' })).toBe(false)
  })

  it('should reject when displayName is empty', () => {
    expect(isGitHubRepoFormPayload({ ...validPayload, displayName: '' })).toBe(false)
  })
})
