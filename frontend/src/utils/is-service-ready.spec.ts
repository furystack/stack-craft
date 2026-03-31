import { describe, expect, it } from 'vitest'
import type { ServiceView } from 'common'

import { isServiceReady } from './is-service-ready.js'

const base: ServiceView = {
  id: 'svc-1',
  stackName: 'test',
  displayName: 'Test',
  description: '',
  runCommand: 'npm start',
  cloneStatus: 'not-cloned',
  installStatus: 'not-installed',
  buildStatus: 'not-built',
  runStatus: 'stopped',
  serviceId: 'svc-1',
  autoFetchEnabled: false,
  autoFetchIntervalMinutes: 60,
  autoRestartOnFetch: false,
  environmentVariableOverrides: {},
  localFiles: [],
  files: [],
  prerequisiteIds: [],
  prerequisiteServiceIds: [],
  createdAt: '',
  updatedAt: '',
}

describe('isServiceReady', () => {
  it('should return true when no repo, install, or build commands are configured', () => {
    const svc: ServiceView = { ...base, repositoryId: undefined, installCommand: undefined, buildCommand: undefined }
    expect(isServiceReady(svc)).toBe(true)
  })

  it('should return true when repo is cloned, install is installed, and build is built', () => {
    const svc: ServiceView = {
      ...base,
      repositoryId: 'repo-1',
      cloneStatus: 'cloned',
      installCommand: 'npm install',
      installStatus: 'installed',
      buildCommand: 'npm run build',
      buildStatus: 'built',
    }
    expect(isServiceReady(svc)).toBe(true)
  })

  it('should return false when repo exists but is not cloned', () => {
    const svc: ServiceView = { ...base, repositoryId: 'repo-1', cloneStatus: 'cloning' }
    expect(isServiceReady(svc)).toBe(false)
  })

  it('should return false when install command exists but is not installed', () => {
    const svc: ServiceView = { ...base, installCommand: 'npm install', installStatus: 'installing' }
    expect(isServiceReady(svc)).toBe(false)
  })

  it('should return false when build command exists but is not built', () => {
    const svc: ServiceView = { ...base, buildCommand: 'npm run build', buildStatus: 'building' }
    expect(isServiceReady(svc)).toBe(false)
  })

  it('should return false when clone has failed', () => {
    const svc: ServiceView = { ...base, repositoryId: 'repo-1', cloneStatus: 'failed' }
    expect(isServiceReady(svc)).toBe(false)
  })

  it('should return false when install has failed', () => {
    const svc: ServiceView = { ...base, installCommand: 'npm install', installStatus: 'failed' }
    expect(isServiceReady(svc)).toBe(false)
  })

  it('should return false when build has failed', () => {
    const svc: ServiceView = { ...base, buildCommand: 'npm run build', buildStatus: 'failed' }
    expect(isServiceReady(svc)).toBe(false)
  })

  it('should ignore clone status when no repository is linked', () => {
    const svc: ServiceView = { ...base, repositoryId: undefined, cloneStatus: 'not-cloned' }
    expect(isServiceReady(svc)).toBe(true)
  })

  it('should ignore install status when no install command is set', () => {
    const svc: ServiceView = { ...base, installCommand: undefined, installStatus: 'not-installed' }
    expect(isServiceReady(svc)).toBe(true)
  })

  it('should ignore build status when no build command is set', () => {
    const svc: ServiceView = { ...base, buildCommand: undefined, buildStatus: 'not-built' }
    expect(isServiceReady(svc)).toBe(true)
  })
})
