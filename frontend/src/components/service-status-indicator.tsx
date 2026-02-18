import { createComponent, Shade } from '@furystack/shades'
import type { Service } from 'common'

type ServiceStatusIndicatorProps = {
  service: Service
}

const getAggregateStatus = (svc: Service): { label: string; color: string } => {
  if (svc.runStatus === 'running') return { label: 'Running', color: '#4caf50' }
  if (svc.runStatus === 'starting') return { label: 'Starting', color: '#ff9800' }
  if (svc.runStatus === 'stopping') return { label: 'Stopping', color: '#ff9800' }
  if (svc.runStatus === 'error') return { label: 'Error', color: '#f44336' }
  if (svc.installStatus === 'installing') return { label: 'Installing', color: '#ff9800' }
  if (svc.installStatus === 'failed') return { label: 'Install Failed', color: '#f44336' }
  if (svc.buildStatus === 'building') return { label: 'Building', color: '#ff9800' }
  if (svc.buildStatus === 'failed') return { label: 'Build Failed', color: '#f44336' }
  return { label: 'Stopped', color: '#9e9e9e' }
}

export const ServiceStatusIndicator = Shade<ServiceStatusIndicatorProps>({
  shadowDomName: 'shade-service-status-indicator',
  render: ({ props }) => {
    const { label, color } = getAggregateStatus(props.service)
    return (
      <span
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '6px',
          fontSize: '13px',
        }}
      >
        <span
          style={{
            width: '8px',
            height: '8px',
            borderRadius: '50%',
            backgroundColor: color,
            display: 'inline-block',
          }}
        />
        {label}
      </span>
    )
  },
})
