import { describe, expect, it } from 'vitest'

import type { ServiceConfig } from '../models/service-config.js'
import type { ServiceDefinition } from '../models/service-definition.js'
import type { ServiceGitStatus } from '../models/service-git-status.js'
import type { ServiceStatus } from '../models/service-status.js'
import { mergeServiceView } from './merge-service-view.js'

const baseDef: ServiceDefinition = {
  id: 'svc-1',
  stackName: 'stack-1',
  displayName: 'Test Service',
  description: 'A test service',
  runCommand: 'npm start',
  files: [],
  createdAt: '2024-01-01',
  updatedAt: '2024-01-01',
}

describe('mergeServiceView', () => {
  it('should produce a ServiceView with defaults when only definition is provided', () => {
    const result = mergeServiceView(baseDef)
    expect(result.serviceId).toBe('svc-1')
    expect(result.displayName).toBe('Test Service')
    expect(result.runCommand).toBe('npm start')
    expect(result.autoFetchEnabled).toBe(false)
    expect(result.autoFetchIntervalMinutes).toBe(60)
    expect(result.autoRestartOnFetch).toBe(false)
    expect(result.environmentVariableOverrides).toEqual({})
    expect(result.localFiles).toEqual([])
    expect(result.cloneStatus).toBe('not-cloned')
    expect(result.installStatus).toBe('not-installed')
    expect(result.buildStatus).toBe('not-built')
    expect(result.runStatus).toBe('stopped')
  })

  it('should merge config values over defaults', () => {
    const config: ServiceConfig = {
      serviceId: 'svc-1',
      autoFetchEnabled: true,
      autoFetchIntervalMinutes: 30,
      autoRestartOnFetch: true,
      environmentVariableOverrides: { KEY: { source: 'custom', customValue: 'val' } },
      localFiles: [{ relativePath: 'config.json', content: '{}' }],
      createdAt: '2024-01-01',
      updatedAt: '2024-01-01',
    }
    const result = mergeServiceView(baseDef, config)
    expect(result.autoFetchEnabled).toBe(true)
    expect(result.autoFetchIntervalMinutes).toBe(30)
    expect(result.autoRestartOnFetch).toBe(true)
    expect(result.environmentVariableOverrides).toEqual({ KEY: { source: 'custom', customValue: 'val' } })
    expect(result.localFiles).toHaveLength(1)
  })

  it('should merge status values over defaults', () => {
    const status: ServiceStatus = {
      serviceId: 'svc-1',
      cloneStatus: 'cloned',
      installStatus: 'installed',
      buildStatus: 'built',
      runStatus: 'running',
      updatedAt: '2024-01-01',
    }
    const result = mergeServiceView(baseDef, undefined, status)
    expect(result.cloneStatus).toBe('cloned')
    expect(result.installStatus).toBe('installed')
    expect(result.buildStatus).toBe('built')
    expect(result.runStatus).toBe('running')
  })

  it('should merge git status values', () => {
    const gitStatus: ServiceGitStatus = {
      serviceId: 'svc-1',
      currentBranch: 'main',
      commitsBehind: 3,
    }
    const result = mergeServiceView(baseDef, undefined, undefined, gitStatus)
    expect(result.currentBranch).toBe('main')
    expect(result.commitsBehind).toBe(3)
  })

  it('should merge all sources together', () => {
    const config: ServiceConfig = {
      serviceId: 'svc-1',
      autoFetchEnabled: true,
      autoFetchIntervalMinutes: 15,
      autoRestartOnFetch: false,
      environmentVariableOverrides: {},
      localFiles: [],
      createdAt: '2024-01-01',
      updatedAt: '2024-01-01',
    }
    const status: ServiceStatus = {
      serviceId: 'svc-1',
      cloneStatus: 'cloned',
      installStatus: 'installed',
      buildStatus: 'built',
      runStatus: 'running',
      updatedAt: '2024-01-01',
    }
    const gitStatus: ServiceGitStatus = {
      serviceId: 'svc-1',
      currentBranch: 'develop',
      commitsBehind: 0,
    }
    const result = mergeServiceView(baseDef, config, status, gitStatus)
    expect(result.serviceId).toBe('svc-1')
    expect(result.autoFetchEnabled).toBe(true)
    expect(result.runStatus).toBe('running')
    expect(result.currentBranch).toBe('develop')
  })

  it('should handle undefined optional parameters gracefully', () => {
    const result = mergeServiceView(baseDef, undefined, undefined, undefined)
    expect(result.serviceId).toBe('svc-1')
    expect(result.runStatus).toBe('stopped')
  })
})
