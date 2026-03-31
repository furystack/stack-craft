import { createComponent, Shade } from '@furystack/shades'
import {
  Button,
  CircularProgress,
  cssVariableTheme,
  Icon,
  icons,
  Timeline,
  TimelineItem,
  Tooltip,
} from '@furystack/shades-common-components'
import type { ServiceView } from 'common'

import type { PipelineStageStatus } from '../utils/service-pipeline.js'
import { getPipelineStages, getStageColor } from '../utils/service-pipeline.js'

type ServicePipelineStepperProps = {
  service: ServiceView
  onAction?: (apiAction: string) => void
  onViewLogs?: (stageId: string) => void
}

const stageApiActions: Record<string, string> = {
  clone: '/services/:id/pull',
  install: '/services/:id/install',
  build: '/services/:id/build',
  run: '/services/:id/start',
}

const stageActionLabels: Record<string, Record<PipelineStageStatus, string | null>> = {
  clone: { skipped: null, pending: 'Clone', 'in-progress': null, done: 'Pull', failed: 'Retry' },
  install: { skipped: null, pending: 'Install', 'in-progress': null, done: 'Reinstall', failed: 'Retry' },
  build: { skipped: null, pending: 'Build', 'in-progress': null, done: 'Rebuild', failed: 'Retry' },
  run: { skipped: null, pending: 'Start', 'in-progress': null, done: 'Restart', failed: 'Start' },
}

const stageActionTooltips: Record<string, Record<PipelineStageStatus, string | null>> = {
  clone: {
    skipped: null,
    pending: 'Clone the repository',
    'in-progress': null,
    done: 'Pull latest changes from remote',
    failed: 'Retry cloning the repository',
  },
  install: {
    skipped: null,
    pending: 'Run install command',
    'in-progress': null,
    done: 'Reinstall dependencies',
    failed: 'Retry install',
  },
  build: {
    skipped: null,
    pending: 'Run build command',
    'in-progress': null,
    done: 'Rebuild the service',
    failed: 'Retry build',
  },
  run: {
    skipped: null,
    pending: 'Start the service',
    'in-progress': null,
    done: null,
    failed: 'Start the service',
  },
}

const DOT_SIZE = 16

const getStatusDot = (status: PipelineStageStatus): JSX.Element => {
  switch (status) {
    case 'skipped':
      return <Icon icon={icons.minus} size={DOT_SIZE} />
    case 'pending':
      return <Icon icon={icons.circleDot} size={DOT_SIZE} />
    case 'in-progress':
      return <CircularProgress size={DOT_SIZE} thickness={2.5} />
    case 'done':
      return <Icon icon={icons.checkCircle} size={DOT_SIZE} />
    case 'failed':
    default:
      return <Icon icon={icons.errorCircle} size={DOT_SIZE} />
  }
}

export const ServicePipelineStepper = Shade<ServicePipelineStepperProps>({
  customElementName: 'shade-service-pipeline-stepper',
  render: ({ props }) => {
    const stages = getPipelineStages(props.service)
    const visibleStages = stages.filter((s) => s.status !== 'skipped')

    const hasInProgress = visibleStages.some((s) => s.status === 'in-progress')
    const { commitsBehind } = props.service

    return (
      <Timeline
        orientation="horizontal"
        pending={hasInProgress ? <CircularProgress size={DOT_SIZE} thickness={2.5} /> : undefined}
      >
        {visibleStages.map((stage) => {
          const color = getStageColor(stage.status)
          const actionLabel = stageActionLabels[stage.id]?.[stage.status] ?? null
          const actionTooltip = stageActionTooltips[stage.id]?.[stage.status] ?? undefined
          const dot = <Tooltip title={stage.command ?? stage.label}>{getStatusDot(stage.status)}</Tooltip>

          const getActionTarget = () => {
            if (stage.id === 'run' && stage.status === 'done') return '/services/:id/stop'
            return stageApiActions[stage.id]
          }

          const showBadge = stage.id === 'clone' && stage.status === 'done' && commitsBehind && commitsBehind > 0

          return (
            <TimelineItem color={color} label={stage.label} dot={dot}>
              <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                {actionLabel && props.onAction ? (
                  <div style={{ position: 'relative', display: 'inline-flex' }}>
                    <Button
                      variant="outlined"
                      size="small"
                      color={color === 'secondary' ? undefined : color}
                      title={actionTooltip}
                      onclick={() => props.onAction!(getActionTarget())}
                    >
                      {stage.id === 'run' && stage.status === 'done' ? 'Stop' : actionLabel}
                    </Button>
                    {showBadge ? (
                      <span
                        style={{
                          position: 'absolute',
                          top: '-6px',
                          right: '-6px',
                          minWidth: '18px',
                          height: '18px',
                          borderRadius: '9px',
                          backgroundColor: cssVariableTheme.palette.primary.main,
                          color: cssVariableTheme.palette.primary.mainContrast,
                          fontSize: '11px',
                          fontWeight: 'bold',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          padding: '0 4px',
                          lineHeight: '1',
                          pointerEvents: 'none',
                        }}
                      >
                        {commitsBehind}
                      </span>
                    ) : null}
                  </div>
                ) : null}
                {(stage.status === 'failed' || stage.status === 'done') && stage.id !== 'clone' && props.onViewLogs ? (
                  <Button
                    variant="text"
                    size="small"
                    onclick={() => props.onViewLogs!(stage.id)}
                    startIcon={<Icon icon={icons.fileText} size="small" />}
                  />
                ) : null}
              </div>
            </TimelineItem>
          )
        })}
      </Timeline>
    )
  },
})
