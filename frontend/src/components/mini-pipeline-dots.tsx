import { createComponent, Shade } from '@furystack/shades'
import { ThemeProviderService } from '@furystack/shades-common-components'
import type { ServiceView } from 'common'

import { getPipelineStages, getStageColor } from '../utils/service-pipeline.js'

type MiniPipelineDotsProps = {
  service: ServiceView
}

export const MiniPipelineDots = Shade<MiniPipelineDotsProps>({
  customElementName: 'shade-mini-pipeline-dots',
  render: ({ props, injector }) => {
    const stages = getPipelineStages(props.service)
    const { theme } = injector.getInstance(ThemeProviderService)

    return (
      <div
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '4px',
        }}
        title={stages.map((s) => `${s.label}: ${s.status}`).join(' | ')}
      >
        {stages.map((stage) => {
          const color = getStageColor(stage.status)
          const paletteColor = theme.palette[color]
          const isSkipped = stage.status === 'skipped'
          const isFilled = stage.status === 'done' || stage.status === 'failed' || stage.status === 'in-progress'

          return (
            <div
              title={`${stage.label}: ${stage.status}`}
              style={{
                width: isSkipped ? '6px' : '10px',
                height: isSkipped ? '6px' : '10px',
                borderRadius: '50%',
                border: `1.5px solid ${isSkipped ? theme.text.disabled : paletteColor.main}`,
                backgroundColor: isFilled ? paletteColor.main : 'transparent',
                opacity: isSkipped ? '0.35' : '1',
                transition: 'all 0.3s ease',
                animation: stage.status === 'in-progress' ? 'dotPulse 1.5s ease-in-out infinite' : 'none',
              }}
            />
          )
        })}
        <style>{`
          @keyframes dotPulse {
            0%, 100% { opacity: 1; }
            50% { opacity: 0.4; }
          }
        `}</style>
      </div>
    )
  },
})
