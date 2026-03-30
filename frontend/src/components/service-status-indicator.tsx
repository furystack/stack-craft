import { createComponent, Shade } from '@furystack/shades'
import type { Palette } from '@furystack/shades-common-components'
import { Chip } from '@furystack/shades-common-components'
import type { ServiceView } from 'common'

type ServiceStatusIndicatorProps = {
  service: ServiceView
}

const getAggregateStatus = (svc: ServiceView): { label: string; color: keyof Palette } => {
  if (svc.runStatus === 'running') return { label: 'Running', color: 'success' }
  if (svc.runStatus === 'starting') return { label: 'Starting', color: 'warning' }
  if (svc.runStatus === 'stopping') return { label: 'Stopping', color: 'warning' }
  if (svc.runStatus === 'error') return { label: 'Error', color: 'error' }
  if (svc.cloneStatus === 'cloning') return { label: 'Cloning', color: 'warning' }
  if (svc.cloneStatus === 'failed') return { label: 'Clone Failed', color: 'error' }
  if (svc.installStatus === 'installing') return { label: 'Installing', color: 'warning' }
  if (svc.installStatus === 'failed') return { label: 'Install Failed', color: 'error' }
  if (svc.buildStatus === 'building') return { label: 'Building', color: 'warning' }
  if (svc.buildStatus === 'failed') return { label: 'Build Failed', color: 'error' }
  return { label: 'Stopped', color: 'secondary' }
}

export const ServiceStatusIndicator = Shade<ServiceStatusIndicatorProps>({
  customElementName: 'shade-service-status-indicator',
  render: ({ props }) => {
    const { label, color } = getAggregateStatus(props.service)
    return (
      <Chip variant="outlined" color={color} size="small" data-testid="service-status-indicator">
        {label}
      </Chip>
    )
  },
})
