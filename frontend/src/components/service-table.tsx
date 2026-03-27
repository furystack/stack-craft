import type { FindOptions } from '@furystack/core'
import { useCollectionSync } from '@furystack/entity-sync-client'
import { serializeToQueryString } from '@furystack/rest'
import { createComponent, NestedRouteLink, Shade } from '@furystack/shades'
import type { ColumnFilterConfig } from '@furystack/shades-common-components'
import {
  Button,
  Chip,
  CollectionService,
  DataGrid,
  Icon,
  icons,
  SelectionCell,
} from '@furystack/shades-common-components'
import { ObservableValue } from '@furystack/utils'
import type { PrerequisiteCheckStatus, ServiceView } from 'common'
import { PrerequisiteCheckResult } from 'common'

import { ServicesApiClient } from '../services/api-clients/services-api-client.js'
import { applyClientFindOptions } from '../utils/apply-client-find-options.js'
import { RunStatusChip } from './status-chips.js'

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
  render: (options) => {
    const { props, injector, useDisposable, useObservable } = options
    const api = injector.getInstance(ServicesApiClient)

    const collectionService = useDisposable(
      'collectionService',
      () => new CollectionService<ServiceView>({ searchField: 'displayName' }),
    )

    const findOptions = useDisposable(
      'findOptionsObservable',
      () => new ObservableValue<FindOptions<ServiceView, Array<keyof ServiceView>>>({ top: 25 }),
    )

    const [currentFindOptions] = useObservable('currentFindOptions', findOptions)
    const { entries, count } = applyClientFindOptions(props.services, currentFindOptions)
    collectionService.data.setValue({ entries, count })

    const checkResultsState = useCollectionSync(options, PrerequisiteCheckResult, {})
    const checkResults =
      checkResultsState.status === 'synced' || checkResultsState.status === 'cached'
        ? checkResultsState.data.entries
        : []
    const checkResultMap = new Map(checkResults.map((r) => [r.prerequisiteId, r]))

    const getPrereqSummary = (prereqIds: string[]) => {
      if (prereqIds.length === 0) return null
      const statuses = prereqIds.map((id): PrerequisiteCheckStatus => checkResultMap.get(id)?.status ?? 'unchecked')
      const satisfiedCount = statuses.filter((s) => s === 'satisfied').length
      const failedCount = statuses.filter((s) => s === 'failed').length
      return { satisfiedCount, failedCount, total: prereqIds.length }
    }

    // Reconcile selection: remap stale object references to current entries by id
    const currentSelection = collectionService.selection.getValue()
    if (currentSelection.length > 0) {
      const entryById = new Map(entries.map((e) => [e.id, e]))
      const reconciled = currentSelection
        .map((s) => entryById.get(s.id))
        .filter((e): e is ServiceView => e !== undefined)
      if (reconciled.length !== currentSelection.length || reconciled.some((e, i) => e !== currentSelection[i])) {
        collectionService.selection.setValue(reconciled)
      }
    }

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
          runStatus: (entry) => {
            const summary = getPrereqSummary(entry.prerequisiteIds)
            return (
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <RunStatusChip status={entry.runStatus} />
                {summary ? (
                  <Chip
                    variant="outlined"
                    size="small"
                    color={
                      summary.failedCount > 0
                        ? 'error'
                        : summary.satisfiedCount === summary.total
                          ? 'success'
                          : 'secondary'
                    }
                    title={`${summary.satisfiedCount}/${summary.total} prerequisite(s) satisfied`}
                  >
                    {summary.satisfiedCount === summary.total
                      ? `✓ ${summary.total} prereq`
                      : `${summary.satisfiedCount}/${summary.total} prereq`}
                  </Chip>
                ) : null}
              </div>
            )
          },
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
