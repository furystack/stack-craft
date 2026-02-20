import type { FindOptions } from '@furystack/core'
import { createComponent, Shade } from '@furystack/shades'
import { Button, CollectionService, DataGrid, Icon, icons, SelectionCell } from '@furystack/shades-common-components'
import { ObservableValue } from '@furystack/utils'
import type { ServiceView } from 'common'

import { ServicesApiClient } from '../services/api-clients/services-api-client.js'
import { ServiceStatusIndicator } from './service-status-indicator.js'

type ServiceTableProps = {
  services: ServiceView[]
  onViewLogs: (serviceId: string) => void
  onDetails: (serviceId: string) => void
  onEdit: (serviceId: string) => void
  onSelectionChange?: (selected: ServiceView[]) => void
}

type ServiceColumn = 'selection' | 'displayName' | 'runStatus' | 'actions'

export const ServiceTable = Shade<ServiceTableProps>({
  shadowDomName: 'shade-service-table',
  render: ({ props, injector, useDisposable, useObservable }) => {
    const api = injector.getInstance(ServicesApiClient)

    const collectionService = useDisposable(
      'collectionService',
      () => new CollectionService<ServiceView>({ searchField: 'displayName' }),
    )

    const findOptions = useDisposable(
      'findOptions',
      () => new ObservableValue<FindOptions<ServiceView, Array<keyof ServiceView>>>({}),
    )

    collectionService.data.setValue({ entries: props.services, count: props.services.length })

    const [selectedServices] = useObservable('selection', collectionService.selection)
    props.onSelectionChange?.(selectedServices)

    return (
      <DataGrid<ServiceView, ServiceColumn>
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
            <div
              style={{ display: 'flex', gap: '2px', alignItems: 'center' }}
              onclick={(e: MouseEvent) => e.stopPropagation()}
            >
              {entry.runStatus !== 'running' ? (
                <Button
                  variant="text"
                  size="small"
                  color="success"
                  title="Start"
                  onclick={() => {
                    void api.call({ method: 'POST', action: '/services/:id/start', url: { id: entry.id } })
                  }}
                  startIcon={<Icon icon={icons.play} size="small" />}
                />
              ) : (
                <Button
                  variant="text"
                  size="small"
                  title="Stop"
                  onclick={() => {
                    void api.call({ method: 'POST', action: '/services/:id/stop', url: { id: entry.id } })
                  }}
                  startIcon={<Icon icon={icons.stopCircle} size="small" />}
                />
              )}
              <Button
                variant="text"
                size="small"
                title="Logs"
                onclick={() => props.onViewLogs(entry.id)}
                startIcon={<Icon icon={icons.fileText} size="small" />}
              />
              <Button
                variant="text"
                size="small"
                title="Details"
                onclick={() => props.onDetails(entry.id)}
                startIcon={<Icon icon={icons.eye} size="small" />}
              />
              <Button
                variant="text"
                size="small"
                title="Edit"
                onclick={() => props.onEdit(entry.id)}
                startIcon={<Icon icon={icons.edit} size="small" />}
              />
            </div>
          ),
        }}
      />
    )
  },
})
