import type { FindOptions } from '@furystack/core'
import { serializeToQueryString } from '@furystack/rest'
import { createComponent, NestedRouteLink, Shade } from '@furystack/shades'
import type { ColumnFilterConfig } from '@furystack/shades-common-components'
import { Button, CollectionService, DataGrid, Icon, icons, SelectionCell } from '@furystack/shades-common-components'
import { ObservableValue } from '@furystack/utils'
import type { ServiceView } from 'common'

import { ServicesApiClient } from '../services/api-clients/services-api-client.js'
import { applyClientFindOptions } from '../utils/apply-client-find-options.js'
import { ServiceStatusIndicator } from './service-status-indicator.js'

type ServiceTableProps = {
  services: ServiceView[]
  onSelectionChange?: (selected: ServiceView[]) => void
}

type ServiceColumn = 'selection' | 'displayName' | 'runStatus' | 'actions'

const columnFilters: { [K in ServiceColumn]?: ColumnFilterConfig } = {
  displayName: { type: 'string' },
  runStatus: {
    type: 'enum',
    values: [
      { label: 'Running', value: 'running' },
      { label: 'Stopped', value: 'stopped' },
      { label: 'Starting', value: 'starting' },
      { label: 'Stopping', value: 'stopping' },
      { label: 'Error', value: 'error' },
    ],
  },
}

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
      () => new ObservableValue<FindOptions<ServiceView, Array<keyof ServiceView>>>({ top: 25 }),
    )

    const [currentFindOptions] = useObservable('findOptions', findOptions)
    const { entries, count } = applyClientFindOptions(props.services, currentFindOptions)
    collectionService.data.setValue({ entries, count })

    const [selectedServices] = useObservable('selection', collectionService.selection)
    props.onSelectionChange?.(selectedServices)

    return (
      <DataGrid<ServiceView, ServiceColumn>
        columns={['selection', 'displayName', 'runStatus', 'actions']}
        findOptions={findOptions}
        styles={undefined}
        collectionService={collectionService}
        columnFilters={columnFilters}
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
          actions: (entry) => {
            const needsSetup =
              (entry.repositoryId && entry.cloneStatus !== 'cloned') ||
              (entry.installCommand && entry.installStatus !== 'installed') ||
              (entry.buildCommand && entry.buildStatus !== 'built')

            return (
              <div
                style={{ display: 'flex', gap: '2px', alignItems: 'center' }}
                onclick={(e: MouseEvent) => e.stopPropagation()}
              >
                {needsSetup ? (
                  <Button
                    variant="text"
                    size="small"
                    title="Set Up"
                    onclick={() => {
                      void api.call({ method: 'POST', action: '/services/:id/setup', url: { id: entry.id } })
                    }}
                    startIcon={<Icon icon={icons.settings} size="small" />}
                  />
                ) : null}
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
                <NestedRouteLink href={`/services/${entry.id}/logs`}>
                  <Button
                    variant="text"
                    size="small"
                    title="Logs"
                    startIcon={<Icon icon={icons.fileText} size="small" />}
                  />
                </NestedRouteLink>
                <NestedRouteLink href={`/services/${entry.id}`}>
                  <Button
                    variant="text"
                    size="small"
                    title="Details"
                    startIcon={<Icon icon={icons.eye} size="small" />}
                  />
                </NestedRouteLink>
                <NestedRouteLink href={`/services/${entry.id}?${serializeToQueryString({ edit: true })}`}>
                  <Button
                    variant="text"
                    size="small"
                    title="Edit"
                    startIcon={<Icon icon={icons.edit} size="small" />}
                  />
                </NestedRouteLink>
              </div>
            )
          },
        }}
      />
    )
  },
})
