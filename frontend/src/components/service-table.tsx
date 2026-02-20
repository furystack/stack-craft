import type { FindOptions } from '@furystack/core'
import { createComponent, Shade } from '@furystack/shades'
import { Button, CollectionService, cssVariableTheme, DataGrid, SelectionCell } from '@furystack/shades-common-components'
import { ObservableValue } from '@furystack/utils'
import type { Service } from 'common'
import { ServicesApiClient } from '../services/api-clients/services-api-client.js'
import { ServiceStatusIndicator } from './service-status-indicator.js'

type ServiceTableProps = {
  services: Service[]
  onViewLogs: (serviceId: string) => void
  onEdit: (serviceId: string) => void
}

type ServiceColumn = 'selection' | 'displayName' | 'runStatus' | 'actions'

export const ServiceTable = Shade<ServiceTableProps>({
  shadowDomName: 'shade-service-table',
  render: ({ props, injector, useDisposable, useObservable, useState }) => {
    const api = injector.getInstance(ServicesApiClient)
    const [loading, setLoading] = useState('loading', false)

    const collectionService = useDisposable(
      'collectionService',
      () => new CollectionService<Service>({ searchField: 'displayName' }),
    )

    const findOptions = useDisposable(
      'findOptions',
      () => new ObservableValue<FindOptions<Service, Array<keyof Service>>>({}),
    )

    collectionService.data.setValue({ entries: props.services, count: props.services.length })

    const [selectedServices] = useObservable('selection', collectionService.selection)

    const hasRunning = selectedServices.some((s) => s.runStatus === 'running')
    const hasStopped = selectedServices.some((s) => s.runStatus !== 'running')

    const bulkAction = async (action: string) => {
      setLoading(true)
      for (const svc of selectedServices) {
        try {
          await api.call({
            method: 'POST',
            action: `/services/:id/${action}` as '/services/:id/start',
            url: { id: svc.id },
          })
        } catch {
          // Individual failures are handled by entity-sync status updates
        }
      }
      setLoading(false)
    }

    return (
      <div>
        {selectedServices.length > 0 ? (
          <div
            style={{
              padding: '8px 16px',
              marginBottom: '8px',
              background: cssVariableTheme.background.paper,
              borderRadius: '8px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
            }}
          >
            <span style={{ fontSize: '14px', opacity: '0.8' }}>{selectedServices.length} selected</span>
            <div style={{ flex: '1' }} />
            {hasStopped ? (
              <Button variant="contained" color="success" disabled={loading} onclick={() => void bulkAction('start')}>
                Start
              </Button>
            ) : null}
            {hasRunning ? (
              <Button variant="outlined" disabled={loading} onclick={() => void bulkAction('stop')}>
                Stop
              </Button>
            ) : null}
            <Button variant="outlined" disabled={loading} onclick={() => void bulkAction('pull')}>
              Pull
            </Button>
            <Button variant="outlined" disabled={loading} onclick={() => void bulkAction('install')}>
              Reinstall
            </Button>
          </div>
        ) : null}
        <DataGrid<Service, ServiceColumn>
          columns={['selection', 'displayName', 'runStatus', 'actions']}
          findOptions={findOptions}
          styles={undefined}
          collectionService={collectionService}
          headerComponents={{
            selection: () => <span />,
            actions: () => <span style={{ paddingLeft: '1em' }}>Actions</span>,
          }}
          rowComponents={{
            selection: (entry) => <SelectionCell entry={entry} service={collectionService} />,
            displayName: (entry) => (
              <span>
                <strong>{entry.displayName}</strong>
                {entry.description ? (
                  <div style={{ fontSize: '12px', opacity: '0.6', marginTop: '2px' }}>{entry.description}</div>
                ) : null}
              </span>
            ),
            runStatus: (entry) => <ServiceStatusIndicator service={entry} />,
            actions: (entry) => (
              <div style={{ display: 'flex', gap: '4px' }}>
                {entry.runStatus !== 'running' ? (
                  <Button
                    variant="outlined"
                    onclick={() => {
                      void api.call({ method: 'POST', action: '/services/:id/start', url: { id: entry.id } })
                    }}
                  >
                    Start
                  </Button>
                ) : (
                  <Button
                    variant="outlined"
                    onclick={() => {
                      void api.call({ method: 'POST', action: '/services/:id/stop', url: { id: entry.id } })
                    }}
                  >
                    Stop
                  </Button>
                )}
                <Button variant="outlined" onclick={() => props.onViewLogs(entry.id)}>
                  Logs
                </Button>
                <Button variant="outlined" onclick={() => props.onEdit(entry.id)}>
                  Edit
                </Button>
              </div>
            ),
          }}
        />
      </div>
    )
  },
})
