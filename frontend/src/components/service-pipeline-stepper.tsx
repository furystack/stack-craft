import { createComponent, Shade } from '@furystack/shades'
import { Button, cssVariableTheme, Timeline, TimelineItem } from '@furystack/shades-common-components'
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

const statusDots: Record<PipelineStageStatus, string> = {
  skipped: '—',
  pending: '○',
  'in-progress': '⏳',
  done: '✓',
  failed: '✗',
}

export const ServicePipelineStepper = Shade<ServicePipelineStepperProps>({
  customElementName: 'shade-service-pipeline-stepper',
  render: ({ props }) => {
    const stages = getPipelineStages(props.service)
    const visibleStages = stages.filter((s) => s.status !== 'skipped')

    const hasInProgress = visibleStages.some((s) => s.status === 'in-progress')

    return (
      <Timeline pending={hasInProgress ? 'Operation in progress...' : undefined}>
        {visibleStages.map((stage) => {
          const color = getStageColor(stage.status)
          const actionLabel = stageActionLabels[stage.id]?.[stage.status] ?? null
          const dot = (
            <span style={{ fontSize: cssVariableTheme.typography.fontSize.md }}>{statusDots[stage.status]}</span>
          )

          const getActionTarget = () => {
            if (stage.id === 'run' && stage.status === 'done') return '/services/:id/stop'
            return stageApiActions[stage.id]
          }

          return (
            <TimelineItem color={color} label={stage.label} dot={dot}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                {stage.command ? (
                  <span
                    style={{
                      fontFamily: 'monospace',
                      fontSize: cssVariableTheme.typography.fontSize.sm,
                      opacity: '0.6',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                      maxWidth: '300px',
                    }}
                    title={stage.command}
                  >
                    {stage.command}
                  </span>
                ) : null}
                <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                  {actionLabel && props.onAction ? (
                    <Button
                      variant="outlined"
                      size="small"
                      color={color === 'secondary' ? undefined : color}
                      onclick={() => props.onAction!(getActionTarget())}
                    >
                      {stage.id === 'run' && stage.status === 'done' ? 'Stop' : actionLabel}
                    </Button>
                  ) : null}
                  {(stage.status === 'failed' || stage.status === 'done') &&
                  stage.id !== 'clone' &&
                  props.onViewLogs ? (
                    <Button variant="text" size="small" onclick={() => props.onViewLogs!(stage.id)}>
                      Logs
                    </Button>
                  ) : null}
                </div>
              </div>
            </TimelineItem>
          )
        })}
      </Timeline>
    )
  },
})
