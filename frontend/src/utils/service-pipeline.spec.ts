import { describe, it, expect } from 'vitest'
import type { ServiceView } from 'common'

import {
  getPipelineStages,
  getPrimaryAction,
  getSecondaryActions,
  getStageColor,
  needsSetup,
} from './service-pipeline.js'

const baseService: ServiceView = {
  id: 'svc-1',
  serviceId: 'svc-1',
  stackName: 'stack-1',
  displayName: 'Test Service',
  description: '',
  runCommand: 'npm start',
  prerequisiteIds: [],
  prerequisiteServiceIds: [],
  files: [],
  autoFetchEnabled: false,
  autoFetchIntervalMinutes: 60,
  autoRestartOnFetch: false,
  environmentVariableOverrides: {},
  cloneStatus: 'not-cloned',
  installStatus: 'not-installed',
  buildStatus: 'not-built',
  runStatus: 'stopped',
  createdAt: '',
  updatedAt: '',
}

describe('getStageColor', () => {
  it('should return correct palette key for each status', () => {
    expect(getStageColor('skipped')).toBe('secondary')
    expect(getStageColor('pending')).toBe('secondary')
    expect(getStageColor('in-progress')).toBe('warning')
    expect(getStageColor('done')).toBe('success')
    expect(getStageColor('failed')).toBe('error')
  })
})

describe('getPipelineStages', () => {
  it('should mark clone as skipped when no repositoryId', () => {
    const stages = getPipelineStages({ ...baseService, repositoryId: undefined })
    expect(stages[0]).toMatchObject({ id: 'clone', status: 'skipped' })
  })

  it('should mark clone as pending when repositoryId present but not cloned', () => {
    const stages = getPipelineStages({ ...baseService, repositoryId: 'repo-1' })
    expect(stages[0]).toMatchObject({ id: 'clone', status: 'pending' })
  })

  it('should mark clone as done when cloned', () => {
    const stages = getPipelineStages({ ...baseService, repositoryId: 'repo-1', cloneStatus: 'cloned' })
    expect(stages[0]).toMatchObject({ id: 'clone', status: 'done' })
  })

  it('should mark clone as in-progress when cloning', () => {
    const stages = getPipelineStages({ ...baseService, repositoryId: 'repo-1', cloneStatus: 'cloning' })
    expect(stages[0]).toMatchObject({ id: 'clone', status: 'in-progress' })
  })

  it('should mark clone as failed when clone failed', () => {
    const stages = getPipelineStages({ ...baseService, repositoryId: 'repo-1', cloneStatus: 'failed' })
    expect(stages[0]).toMatchObject({ id: 'clone', status: 'failed' })
  })

  it('should mark install as skipped when no installCommand', () => {
    const stages = getPipelineStages({ ...baseService, installCommand: undefined })
    expect(stages[1]).toMatchObject({ id: 'install', status: 'skipped' })
  })

  it('should mark install as pending when command present but not installed', () => {
    const stages = getPipelineStages({ ...baseService, installCommand: 'npm install' })
    expect(stages[1]).toMatchObject({ id: 'install', status: 'pending', command: 'npm install' })
  })

  it('should mark build as skipped when no buildCommand', () => {
    const stages = getPipelineStages({ ...baseService, buildCommand: undefined })
    expect(stages[2]).toMatchObject({ id: 'build', status: 'skipped' })
  })

  it('should map run status correctly', () => {
    expect(getPipelineStages({ ...baseService, runStatus: 'running' })[3]).toMatchObject({
      id: 'run',
      status: 'done',
    })
    expect(getPipelineStages({ ...baseService, runStatus: 'starting' })[3]).toMatchObject({
      id: 'run',
      status: 'in-progress',
    })
    expect(getPipelineStages({ ...baseService, runStatus: 'error' })[3]).toMatchObject({
      id: 'run',
      status: 'failed',
    })
    expect(getPipelineStages({ ...baseService, runStatus: 'stopped' })[3]).toMatchObject({
      id: 'run',
      status: 'pending',
    })
  })

  it('should always return 4 stages', () => {
    const stages = getPipelineStages(baseService)
    expect(stages).toHaveLength(4)
    expect(stages.map((s) => s.id)).toEqual(['clone', 'install', 'build', 'run'])
  })
})

describe('getPrimaryAction', () => {
  it('should return Stop when service is running', () => {
    const action = getPrimaryAction({ ...baseService, runStatus: 'running' })
    expect(action).toMatchObject({ label: 'Stop', color: 'error', apiAction: '/services/:id/stop' })
  })

  it('should return Stop with warning color when starting/stopping', () => {
    expect(getPrimaryAction({ ...baseService, runStatus: 'starting' })).toMatchObject({
      label: 'Stop',
      color: 'warning',
    })
    expect(getPrimaryAction({ ...baseService, runStatus: 'stopping' })).toMatchObject({
      label: 'Stop',
      color: 'warning',
    })
  })

  it('should return retry action when a stage has failed', () => {
    const action = getPrimaryAction({
      ...baseService,
      repositoryId: 'repo-1',
      cloneStatus: 'failed',
    })
    expect(action).toMatchObject({ label: 'Retry Clone', color: 'error', apiAction: '/services/:id/pull' })
  })

  it('should return in-progress label when a stage is in progress', () => {
    const action = getPrimaryAction({
      ...baseService,
      repositoryId: 'repo-1',
      cloneStatus: 'cloning',
    })
    expect(action.label).toContain('ing...')
    expect(action.apiAction).toBe('')
  })

  it('should return Clone when repo is pending', () => {
    const action = getPrimaryAction({ ...baseService, repositoryId: 'repo-1' })
    expect(action).toMatchObject({ label: 'Clone', apiAction: '/services/:id/pull' })
  })

  it('should return Start when all done and stopped', () => {
    const action = getPrimaryAction({
      ...baseService,
      repositoryId: 'repo-1',
      cloneStatus: 'cloned',
      installCommand: 'npm i',
      installStatus: 'installed',
      buildCommand: 'npm run build',
      buildStatus: 'built',
      runStatus: 'stopped',
    })
    expect(action).toMatchObject({ label: 'Start', color: 'success', apiAction: '/services/:id/start' })
  })
})

describe('getSecondaryActions', () => {
  it('should return Restart and Update when running', () => {
    const actions = getSecondaryActions({ ...baseService, runStatus: 'running' })
    expect(actions.some((a) => a.label === 'Restart')).toBe(true)
    expect(actions.some((a) => a.label === 'Update')).toBe(true)
  })

  it('should return Set Up All when there are pending stages', () => {
    const actions = getSecondaryActions({ ...baseService, repositoryId: 'repo-1' })
    expect(actions.some((a) => a.label === 'Set Up All')).toBe(true)
  })

  it('should return Update when stopped and cloned', () => {
    const actions = getSecondaryActions({
      ...baseService,
      repositoryId: 'repo-1',
      cloneStatus: 'cloned',
      runStatus: 'stopped',
    })
    expect(actions.some((a) => a.label === 'Update')).toBe(true)
  })

  it('should return empty when nothing applicable', () => {
    const actions = getSecondaryActions({
      ...baseService,
      cloneStatus: 'cloned',
      installCommand: 'npm i',
      installStatus: 'installed',
      runStatus: 'stopped',
    })
    expect(actions).toHaveLength(0)
  })
})

describe('needsSetup', () => {
  it('should return true when repo not cloned', () => {
    expect(needsSetup({ ...baseService, repositoryId: 'repo-1', cloneStatus: 'not-cloned' })).toBe(true)
  })

  it('should return true when install command present but not installed', () => {
    expect(needsSetup({ ...baseService, installCommand: 'npm i', installStatus: 'not-installed' })).toBe(true)
  })

  it('should return true when build command present but not built', () => {
    expect(needsSetup({ ...baseService, buildCommand: 'npm run build', buildStatus: 'not-built' })).toBe(true)
  })

  it('should return false when everything is set up', () => {
    expect(
      needsSetup({
        ...baseService,
        repositoryId: 'repo-1',
        cloneStatus: 'cloned',
        installCommand: 'npm i',
        installStatus: 'installed',
        buildCommand: 'npm run build',
        buildStatus: 'built',
      }),
    ).toBe(false)
  })

  it('should return false when no setup is needed', () => {
    expect(needsSetup(baseService)).toBe(false)
  })
})
