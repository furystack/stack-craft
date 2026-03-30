import { describe, expect, it } from 'vitest'

import type { PrerequisiteFormPayload } from './prerequisite-form.js'
import { buildConfig, isPrerequisiteFormPayload } from './prerequisite-form.js'

describe('isPrerequisiteFormPayload', () => {
  describe('common field validation', () => {
    it('should throw on null (no null guard)', () => {
      expect(() => isPrerequisiteFormPayload(null)).toThrow()
    })

    it('should throw on undefined (no null guard)', () => {
      expect(() => isPrerequisiteFormPayload(undefined)).toThrow()
    })

    it('should reject a non-object', () => {
      expect(isPrerequisiteFormPayload('string')).toBe(false)
    })

    it('should reject when name is missing', () => {
      expect(isPrerequisiteFormPayload({ type: 'git' })).toBe(false)
    })

    it('should reject when name is empty', () => {
      expect(isPrerequisiteFormPayload({ name: '', type: 'git' })).toBe(false)
    })

    it('should reject when type is missing', () => {
      expect(isPrerequisiteFormPayload({ name: 'Git' })).toBe(false)
    })

    it('should reject when type is empty', () => {
      expect(isPrerequisiteFormPayload({ name: 'Git', type: '' })).toBe(false)
    })
  })

  describe('node type', () => {
    it('should accept valid node payload', () => {
      expect(isPrerequisiteFormPayload({ name: 'Node', type: 'node', minimumVersion: '18.0.0' })).toBe(true)
    })

    it('should reject node without minimumVersion', () => {
      expect(isPrerequisiteFormPayload({ name: 'Node', type: 'node' })).toBe(false)
    })

    it('should reject node with empty minimumVersion', () => {
      expect(isPrerequisiteFormPayload({ name: 'Node', type: 'node', minimumVersion: '' })).toBe(false)
    })
  })

  describe('yarn type', () => {
    it('should accept valid yarn payload', () => {
      expect(isPrerequisiteFormPayload({ name: 'Yarn', type: 'yarn', minimumVersion: '4.0.0' })).toBe(true)
    })

    it('should reject yarn without minimumVersion', () => {
      expect(isPrerequisiteFormPayload({ name: 'Yarn', type: 'yarn' })).toBe(false)
    })

    it('should reject yarn with empty minimumVersion', () => {
      expect(isPrerequisiteFormPayload({ name: 'Yarn', type: 'yarn', minimumVersion: '' })).toBe(false)
    })
  })

  describe('dotnet-sdk type', () => {
    it('should accept valid dotnet-sdk payload', () => {
      expect(isPrerequisiteFormPayload({ name: '.NET SDK', type: 'dotnet-sdk', version: '8.0' })).toBe(true)
    })

    it('should reject dotnet-sdk without version', () => {
      expect(isPrerequisiteFormPayload({ name: '.NET SDK', type: 'dotnet-sdk' })).toBe(false)
    })

    it('should reject dotnet-sdk with empty version', () => {
      expect(isPrerequisiteFormPayload({ name: '.NET SDK', type: 'dotnet-sdk', version: '' })).toBe(false)
    })
  })

  describe('dotnet-runtime type', () => {
    it('should accept valid dotnet-runtime payload', () => {
      expect(isPrerequisiteFormPayload({ name: '.NET Runtime', type: 'dotnet-runtime', version: '8.0' })).toBe(true)
    })

    it('should reject dotnet-runtime without version', () => {
      expect(isPrerequisiteFormPayload({ name: '.NET Runtime', type: 'dotnet-runtime' })).toBe(false)
    })
  })

  describe('nuget-feed type', () => {
    it('should accept valid nuget-feed payload', () => {
      expect(
        isPrerequisiteFormPayload({
          name: 'My Feed',
          type: 'nuget-feed',
          feedUrl: 'https://nuget.example.com/v3/index.json',
        }),
      ).toBe(true)
    })

    it('should reject nuget-feed without feedUrl', () => {
      expect(isPrerequisiteFormPayload({ name: 'My Feed', type: 'nuget-feed' })).toBe(false)
    })

    it('should reject nuget-feed with empty feedUrl', () => {
      expect(isPrerequisiteFormPayload({ name: 'My Feed', type: 'nuget-feed', feedUrl: '' })).toBe(false)
    })
  })

  describe('git type', () => {
    it('should accept valid git payload', () => {
      expect(isPrerequisiteFormPayload({ name: 'Git', type: 'git' })).toBe(true)
    })
  })

  describe('github-cli type', () => {
    it('should accept valid github-cli payload', () => {
      expect(isPrerequisiteFormPayload({ name: 'GitHub CLI', type: 'github-cli' })).toBe(true)
    })
  })

  describe('env-variable type', () => {
    it('should accept valid env-variable payload', () => {
      expect(isPrerequisiteFormPayload({ name: 'GH Token', type: 'env-variable', variableName: 'GITHUB_TOKEN' })).toBe(
        true,
      )
    })

    it('should reject env-variable without variableName', () => {
      expect(isPrerequisiteFormPayload({ name: 'GH Token', type: 'env-variable' })).toBe(false)
    })

    it('should reject env-variable with empty variableName', () => {
      expect(isPrerequisiteFormPayload({ name: 'GH Token', type: 'env-variable', variableName: '' })).toBe(false)
    })
  })

  describe('custom-script type', () => {
    it('should accept valid custom-script payload', () => {
      expect(
        isPrerequisiteFormPayload({ name: 'Docker check', type: 'custom-script', script: 'docker --version' }),
      ).toBe(true)
    })

    it('should reject custom-script without script', () => {
      expect(isPrerequisiteFormPayload({ name: 'Docker check', type: 'custom-script' })).toBe(false)
    })

    it('should reject custom-script with empty script', () => {
      expect(isPrerequisiteFormPayload({ name: 'Docker check', type: 'custom-script', script: '' })).toBe(false)
    })
  })
})

describe('buildConfig', () => {
  it('should return { minimumVersion } for node', () => {
    const payload: PrerequisiteFormPayload = { name: 'Node', type: 'node', minimumVersion: '18.0.0' }
    expect(buildConfig(payload)).toEqual({ minimumVersion: '18.0.0' })
  })

  it('should return { minimumVersion } for yarn', () => {
    const payload: PrerequisiteFormPayload = { name: 'Yarn', type: 'yarn', minimumVersion: '4.0.0' }
    expect(buildConfig(payload)).toEqual({ minimumVersion: '4.0.0' })
  })

  it('should return { version } for dotnet-sdk', () => {
    const payload: PrerequisiteFormPayload = { name: '.NET SDK', type: 'dotnet-sdk', version: '8.0' }
    expect(buildConfig(payload)).toEqual({ version: '8.0' })
  })

  it('should return { version } for dotnet-runtime', () => {
    const payload: PrerequisiteFormPayload = { name: '.NET Runtime', type: 'dotnet-runtime', version: '8.0' }
    expect(buildConfig(payload)).toEqual({ version: '8.0' })
  })

  it('should return { feedUrl } for nuget-feed without feedName', () => {
    const payload: PrerequisiteFormPayload = {
      name: 'Feed',
      type: 'nuget-feed',
      feedUrl: 'https://nuget.example.com',
    }
    expect(buildConfig(payload)).toEqual({ feedUrl: 'https://nuget.example.com' })
  })

  it('should return { feedUrl, feedName } for nuget-feed with feedName', () => {
    const payload: PrerequisiteFormPayload = {
      name: 'Feed',
      type: 'nuget-feed',
      feedUrl: 'https://nuget.example.com',
      feedName: 'My Feed',
    }
    expect(buildConfig(payload)).toEqual({ feedUrl: 'https://nuget.example.com', feedName: 'My Feed' })
  })

  it('should return {} for git', () => {
    const payload: PrerequisiteFormPayload = { name: 'Git', type: 'git' }
    expect(buildConfig(payload)).toEqual({})
  })

  it('should return {} for github-cli', () => {
    const payload: PrerequisiteFormPayload = { name: 'GH CLI', type: 'github-cli' }
    expect(buildConfig(payload)).toEqual({})
  })

  it('should return { variableName } for env-variable without isSensitive', () => {
    const payload: PrerequisiteFormPayload = {
      name: 'Token',
      type: 'env-variable',
      variableName: 'GITHUB_TOKEN',
    }
    expect(buildConfig(payload)).toEqual({ variableName: 'GITHUB_TOKEN' })
  })

  it('should return { variableName, isSensitive } when isSensitive is "on"', () => {
    const payload: PrerequisiteFormPayload = {
      name: 'Token',
      type: 'env-variable',
      variableName: 'GITHUB_TOKEN',
      isSensitive: 'on',
    }
    expect(buildConfig(payload)).toEqual({ variableName: 'GITHUB_TOKEN', isSensitive: true })
  })

  it('should not include isSensitive when it is not "on"', () => {
    const payload: PrerequisiteFormPayload = {
      name: 'Token',
      type: 'env-variable',
      variableName: 'GITHUB_TOKEN',
      isSensitive: 'off',
    }
    expect(buildConfig(payload)).toEqual({ variableName: 'GITHUB_TOKEN' })
  })

  it('should return { script } for custom-script', () => {
    const payload: PrerequisiteFormPayload = {
      name: 'Docker',
      type: 'custom-script',
      script: 'docker --version',
    }
    expect(buildConfig(payload)).toEqual({ script: 'docker --version' })
  })

  it('should return {} for an unknown type', () => {
    const payload = { name: 'Unknown', type: 'unknown-type' } as unknown as PrerequisiteFormPayload
    expect(buildConfig(payload)).toEqual({})
  })
})
