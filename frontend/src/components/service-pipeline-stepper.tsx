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

export const ServicePipelineStepper = Shade<ServicePipelineStepperProps>({
  customElementName: 'shade-service-pipeline-stepper',
  render: ({ props }) => {
    const stages = getPipelineStages(props.service)
    const visibleStages = stages.filter((s) => s.status !== 'skipped')

    const hasInProgress = visibleStages.some((s) => s.status === 'in-progress')
    const commitsBehind = props.service.commitsBehind

    return (
      <Timeline pending={hasInProgress ? 'Operation in progress...' : undefined}>
        {visibleStages.map((stage) => {
          const color = getStageColor(stage.status)
          const actionLabel = stageActionLabels[stage.id]?.[stage.status] ?? null
          const actionTooltip = stageActionTooltips[stage.id]?.[stage.status] ?? undefined
          const dot = (
            <span style={{ fontSize: cssVariableTheme.typography.fontSize.md }}>{statusDots[stage.status]}</span>
          )

          const getActionTarget = () => {
            if (stage.id === 'run' && stage.status === 'done') return '/services/:id/stop'
            return stageApiActions[stage.id]
          }

          const showBadge = stage.id === 'clone' && stage.status === 'done' && commitsBehind && commitsBehind > 0

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
