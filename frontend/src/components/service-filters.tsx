import { createComponent, Shade } from '@furystack/shades'
import {
  Button,
  cssVariableTheme,
  Icon,
  icons,
  NotyService,
  ToggleButton,
  ToggleButtonGroup,
} from '@furystack/shades-common-components'
import type { ServiceView } from 'common'

import { ServicesApiClient } from '../services/api-clients/services-api-client.js'
import type { ServiceSummaryStatus } from '../utils/service-pipeline.js'

type ServiceFiltersProps = {
  filteredServices: ServiceView[]
  searchText: string
  onSearchTextChange: (text: string) => void
  statusFilter: string
  onStatusFilterChange: (value: string) => void
}

const statusOptions: Array<{ value: ServiceSummaryStatus; label: string }> = [
  { value: 'running', label: 'Running' },
  { value: 'in-progress', label: 'In Progress' },
  { value: 'error', label: 'Error' },
  { value: 'pending', label: 'Pending' },
]

export const ServiceFilters = Shade<ServiceFiltersProps>({
  customElementName: 'shade-service-filters',
  render: ({ props, injector, useState }) => {
    const api = injector.get(ServicesApiClient)
    const noty = injector.get(NotyService)
    const [isUpdateLoading, setIsUpdateLoading] = useState('isUpdateLoading', false)

    const updatableServices = props.filteredServices.filter(
      (s) => s.cloneStatus === 'cloned' && s.commitsBehind && s.commitsBehind > 0,
    )

    const updateAll = async () => {
      setIsUpdateLoading(true)
      const failures: string[] = []
      for (const svc of updatableServices) {
        try {
          await api.call({
            method: 'POST',
            action: '/services/:id/update' as '/services/:id/start',
            url: { id: svc.id },
          })
        } catch {
          failures.push(svc.displayName)
        }
      }
      if (failures.length > 0) {
        noty.emit('onNotyAdded', {
          title: 'Update failed',
          body: `Failed for: ${failures.join(', ')}`,
          type: 'error',
        })
      }
      setIsUpdateLoading(false)
    }

    return (
      <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
        <div style={{ position: 'relative', display: 'inline-flex', alignItems: 'center' }}>
          <Icon
            icon={icons.search}
            size={14}
            style={{
              position: 'absolute',
              left: '8px',
              pointerEvents: 'none',
              opacity: '0.5',
            }}
          />
          <input
            type="text"
            placeholder="Search..."
            value={props.searchText}
            oninput={(e: Event) => props.onSearchTextChange((e.target as HTMLInputElement).value)}
            style={{
              padding: '4px 8px 4px 28px',
              borderRadius: cssVariableTheme.shape.borderRadius.sm,
              border: `1px solid ${cssVariableTheme.divider}`,
              background: cssVariableTheme.background.default,
              color: cssVariableTheme.text.primary,
              fontSize: cssVariableTheme.typography.fontSize.sm,
              width: '160px',
              outline: 'none',
              fontFamily: cssVariableTheme.typography.fontFamily,
            }}
          />
        </div>

        <ToggleButtonGroup
          exclusive
          size="small"
          value={props.statusFilter}
          onValueChange={(value) => props.onStatusFilterChange(typeof value === 'string' ? value : '')}
        >
          {statusOptions.map((opt) => (
            <ToggleButton value={opt.value}>{opt.label}</ToggleButton>
          ))}
        </ToggleButtonGroup>

        {updatableServices.length > 0 ? (
          <Button
            variant="outlined"
            size="small"
            color="primary"
            loading={isUpdateLoading}
            onclick={() => void updateAll()}
            startIcon={<Icon icon={icons.download} size="small" />}
          >
            {`Update All (${updatableServices.length})`}
          </Button>
        ) : null}
      </div>
    )
  },
})
