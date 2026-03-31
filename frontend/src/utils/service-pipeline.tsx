import { createComponent } from '@furystack/shades'
import { CircularProgress, Icon, icons, type Palette } from '@furystack/shades-common-components'
import type { ServiceView } from 'common'

export type PipelineStageId = 'clone' | 'install' | 'build' | 'run'
export type PipelineStageStatus = 'skipped' | 'pending' | 'in-progress' | 'done' | 'failed'

export type PipelineStage = {
  id: PipelineStageId
  label: string
  status: PipelineStageStatus
  command?: string
}

export type ServiceAction = {
  label: string
  apiAction: string
  color: keyof Palette
  icon: JSX.Element
  tooltip?: string
}

const stageStatusColor: Record<PipelineStageStatus, keyof Palette> = {
  skipped: 'secondary',
  pending: 'secondary',
  'in-progress': 'warning',
  done: 'success',
  failed: 'error',
}

export const getStageColor = (status: PipelineStageStatus): keyof Palette => stageStatusColor[status]

export const getPipelineStages = (service: ServiceView): PipelineStage[] => {
  const stages: PipelineStage[] = []

  if (service.repositoryId) {
    const cloneStatus: PipelineStageStatus =
      service.cloneStatus === 'cloned'
        ? 'done'
        : service.cloneStatus === 'cloning'
          ? 'in-progress'
          : service.cloneStatus === 'failed'
            ? 'failed'
            : 'pending'
    stages.push({ id: 'clone', label: 'Clone', status: cloneStatus })
  } else {
    stages.push({ id: 'clone', label: 'Clone', status: 'skipped' })
  }

  if (service.installCommand) {
    const installStatus: PipelineStageStatus =
      service.installStatus === 'installed'
        ? 'done'
        : service.installStatus === 'installing'
          ? 'in-progress'
          : service.installStatus === 'failed'
            ? 'failed'
            : 'pending'
    stages.push({ id: 'install', label: 'Install', status: installStatus, command: service.installCommand })
  } else {
    stages.push({ id: 'install', label: 'Install', status: 'skipped' })
  }

  if (service.buildCommand) {
    const buildStatus: PipelineStageStatus =
      service.buildStatus === 'built'
        ? 'done'
        : service.buildStatus === 'building'
          ? 'in-progress'
          : service.buildStatus === 'failed'
            ? 'failed'
            : 'pending'
    stages.push({ id: 'build', label: 'Build', status: buildStatus, command: service.buildCommand })
  } else {
    stages.push({ id: 'build', label: 'Build', status: 'skipped' })
  }

  const runStatus: PipelineStageStatus =
    service.runStatus === 'running'
      ? 'done'
      : service.runStatus === 'starting' || service.runStatus === 'stopping'
        ? 'in-progress'
        : service.runStatus === 'error'
          ? 'failed'
          : 'pending'
  stages.push({ id: 'run', label: 'Run', status: runStatus, command: service.runCommand })

  return stages
}

const stageActionMap: Record<PipelineStageId, { label: string; retryLabel: string; apiAction: string }> = {
  clone: { label: 'Clone', retryLabel: 'Retry Clone', apiAction: '/services/:id/pull' },
  install: { label: 'Install', retryLabel: 'Retry Install', apiAction: '/services/:id/install' },
  build: { label: 'Build', retryLabel: 'Retry Build', apiAction: '/services/:id/build' },
  run: { label: 'Start', retryLabel: 'Start', apiAction: '/services/:id/start' },
}

export const getPrimaryAction = (service: ServiceView): ServiceAction => {
  if (service.runStatus === 'running') {
    return {
      label: 'Stop',
      apiAction: '/services/:id/stop',
      color: 'error',
      icon: <Icon icon={icons.stopCircle} size="small" />,
    }
  }
  if (service.runStatus === 'starting' || service.runStatus === 'stopping') {
    return {
      label: 'Stop',
      apiAction: '/services/:id/stop',
      color: 'warning',
      icon: <Icon icon={icons.stopCircle} size="small" />,
    }
  }

  const stages = getPipelineStages(service)
  const failedStage = stages.find((s) => s.status === 'failed')
  if (failedStage) {
    const map = stageActionMap[failedStage.id]
    return {
      label: map.retryLabel,
      apiAction: map.apiAction,
      color: 'error',
      icon: <Icon icon={icons.refresh} size="small" />,
    }
  }

  const inProgressStage = stages.find((s) => s.status === 'in-progress')
  if (inProgressStage) {
    return {
      label: `${inProgressStage.label}ing...`,
      apiAction: '',
      color: 'warning',
      icon: <CircularProgress size={12} thickness={2.5} />,
    }
  }

  const pendingStage = stages.find((s) => s.status === 'pending')
  if (pendingStage) {
    if (pendingStage.id === 'run') {
      return {
        label: 'Start',
        apiAction: '/services/:id/start',
        color: 'success',
        icon: <Icon icon={icons.play} size="small" />,
      }
    }
    const map = stageActionMap[pendingStage.id]
    return {
      label: map.label,
      apiAction: map.apiAction,
      color: 'primary',
      icon: <Icon icon={icons.settings} size="small" />,
    }
  }

  return {
    label: 'Start',
    apiAction: '/services/:id/start',
    color: 'success',
    icon: <Icon icon={icons.play} size="small" />,
  }
}

export const getSecondaryActions = (service: ServiceView): ServiceAction[] => {
  const actions: ServiceAction[] = []

  if (service.runStatus === 'running') {
    actions.push({
      label: 'Restart',
      apiAction: '/services/:id/restart',
      color: 'warning',
      icon: <Icon icon={icons.refresh} size="small" />,
    })
    actions.push({
      label: 'Update',
      apiAction: '/services/:id/update',
      color: 'primary',
      icon: <Icon icon={icons.refresh} size="small" />,
      tooltip: 'Pull, install, build, and restart if running',
    })
  }

  const stages = getPipelineStages(service)
  const hasPendingStages = stages.some((s) => s.status === 'pending' && s.id !== 'run')
  if (hasPendingStages) {
    actions.push({
      label: 'Set Up All',
      apiAction: '/services/:id/setup',
      color: 'primary',
      icon: <Icon icon={icons.settings} size="small" />,
      tooltip: 'Clone, install, and build (initial provisioning)',
    })
  }

  if (service.runStatus === 'stopped' || service.runStatus === 'error') {
    if (service.repositoryId && service.cloneStatus === 'cloned') {
      actions.push({
        label: 'Update',
        apiAction: '/services/:id/update',
        color: 'primary',
        icon: <Icon icon={icons.refresh} size="small" />,
        tooltip: 'Pull, install, build, and restart if running',
      })
    }
  }

  return actions
}

export const needsSetup = (service: ServiceView): boolean => {
  if (service.repositoryId && service.cloneStatus !== 'cloned') return true
  if (service.installCommand && service.installStatus !== 'installed') return true
  if (service.buildCommand && service.buildStatus !== 'built') return true
  return false
}
