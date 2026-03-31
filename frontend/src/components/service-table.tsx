import type { FindOptions } from '@furystack/core'
import { createComponent, LocationService, Shade } from '@furystack/shades'
import type { ColumnFilterConfig } from '@furystack/shades-common-components'
import {
  Button,
  CollectionService,
  cssVariableTheme,
  DataGrid,
  Icon,
  icons,
  MarkdownDisplay,
  NotyService,
  SelectionCell,
} from '@furystack/shades-common-components'
import type { ServiceView } from 'common'

import { ServicesApiClient } from '../services/api-clients/services-api-client.js'
import { applyClientFindOptions } from '../utils/apply-client-find-options.js'
import { getPrimaryAction } from '../utils/service-pipeline.js'
import { StackCraftNestedRouteLink } from './app-routes.js'
import { BranchSelector } from './branch-selector.js'
import { MiniPipelineDots } from './mini-pipeline-dots.js'
import { PrerequisiteSummaryChip } from './prerequisite-summary-chip.js'

type ServiceTableProps = {
  services: ServiceView[]
  onSelectionChange?: (selected: ServiceView[]) => void
}

type ServiceColumn = 'selection' | 'displayName' | 'pipeline' | 'branch' | 'actions'

const columnFilters: { [K in ServiceColumn]?: ColumnFilterConfig } = {
  displayName: { type: 'string' },
}

export const ServiceTable = Shade<ServiceTableProps>({
  customElementName: 'shade-service-table',
  render: (options) => {
    const { props, injector, useDisposable, useState } = options
    const api = injector.getInstance(ServicesApiClient)
    const noty = injector.getInstance(NotyService)

    const callServiceAction = (serviceId: string, action: string, actionLabel: string) => {
      void api
        .call({
          method: 'POST',
          action: `/services/:id/${action}` as '/services/:id/start',
          url: { id: serviceId },
        })
        .catch((error: unknown) => {
          noty.emit('onNotyAdded', {
            title: `${actionLabel} failed`,
            body: error instanceof Error ? error.message : `Failed to execute ${actionLabel}`,
            type: 'error',
          })
        })
    }

    const collectionService = useDisposable(
      'collectionService',
      () => new CollectionService<ServiceView>({ searchField: 'displayName' }),
    )

    const [findOptions, setFindOptions] = useState<FindOptions<ServiceView, Array<keyof ServiceView>>>(
      'findOptionsObservable',
      { top: 25 },
    )

    const { entries, count } = applyClientFindOptions(props.services, findOptions)
    collectionService.data.setValue({ entries, count })

    const currentSelection = collectionService.selection.getValue()
    if (currentSelection.length > 0) {
      const entryById = new Map(entries.map((e) => [e.id, e]))
      const reconciled = currentSelection
        .map((s) => entryById.get(s.id))
        .filter((e): e is ServiceView => e !== undefined)
      if (reconciled.length !== currentSelection.length || reconciled.some((e, i) => e.id !== currentSelection[i].id)) {
        collectionService.selection.setValue(reconciled)
      }
    }

    useDisposable('selectionSync', () =>
      collectionService.selection.subscribe((newSelection) => {
        props.onSelectionChange?.(newSelection)
      }),
    )

    return (
      <DataGrid<ServiceView, ServiceColumn>
        columns={['selection', 'displayName', 'pipeline', 'branch', 'actions']}
        findOptions={findOptions}
        onFindOptionsChange={setFindOptions}
        styles={undefined}
        collectionService={collectionService}
        columnFilters={columnFilters}
        headerComponents={{
          selection: () => <span />,
          displayName: () => <span>Service</span>,
          pipeline: () => <span>Status</span>,
          branch: () => <span>Branch</span>,
          actions: () => <span style={{ paddingLeft: '1em' }}>Actions</span>,
        }}
        rowComponents={{
          selection: (entry) => <SelectionCell entry={entry} service={collectionService} />,
          displayName: (entry) => (
            <span>
              <strong>{entry.displayName}</strong>
              {entry.description ? (
                <div style={{ fontSize: cssVariableTheme.typography.fontSize.sm, opacity: '0.6', marginTop: '2px' }}>
                  <MarkdownDisplay content={entry.description} />
                </div>
              ) : null}
              {entry.prerequisiteIds.length > 0 ? (
                <div style={{ marginTop: '4px' }}>
                  <PrerequisiteSummaryChip prerequisiteIds={entry.prerequisiteIds} />
                </div>
              ) : null}
            </span>
          ),
          pipeline: (entry) => <MiniPipelineDots service={entry} />,
          branch: (entry) => (
            <div onclick={(e: MouseEvent) => e.stopPropagation()}>
              <BranchSelector
                serviceId={entry.id}
                currentBranch={entry.currentBranch}
                isCloned={entry.cloneStatus === 'cloned'}
              />
            </div>
          ),
          actions: (entry) => {
            const primary = getPrimaryAction(entry)

            return (
              <div
                style={{ display: 'flex', gap: '2px', alignItems: 'center' }}
                onclick={(e: MouseEvent) => e.stopPropagation()}
              >
                {/* Context-aware primary action */}
                {primary.apiAction ? (
                  <Button
                    variant="text"
                    size="small"
                    color={primary.color === 'secondary' ? undefined : primary.color}
                    title={primary.label}
                    aria-label={primary.label}
                    onclick={() => callServiceAction(entry.id, primary.apiAction.split('/').pop()!, primary.label)}
                    startIcon={<Icon icon={icons[primary.icon as keyof typeof icons] ?? icons.play} size="small" />}
                  />
                ) : null}
                {/* Restart (when running) */}
                {entry.runStatus === 'running' ? (
                  <Button
                    variant="text"
                    size="small"
                    color="warning"
                    title="Restart"
                    aria-label="Restart"
                    onclick={() => callServiceAction(entry.id, 'restart', 'Restart')}
                    startIcon={<Icon icon={icons.refresh} size="small" />}
                  />
                ) : null}
                {/* Update (pull + install + build + restart if running) */}
                {entry.repositoryId && entry.cloneStatus === 'cloned' ? (
                  <div style={{ position: 'relative', display: 'inline-flex' }}>
                    <Button
                      variant="text"
                      size="small"
                      title="Update: pull, install, build, and restart if running"
                      aria-label="Update"
                      onclick={() => callServiceAction(entry.id, 'update', 'Update')}
                      startIcon={<Icon icon={icons.download} size="small" />}
                    />
                    {entry.commitsBehind ? (
                      <span
                        style={{
                          position: 'absolute',
                          top: '-2px',
                          right: '-2px',
                          minWidth: '16px',
                          height: '16px',
                          borderRadius: '8px',
                          backgroundColor: cssVariableTheme.palette.primary.main,
                          color: cssVariableTheme.palette.primary.mainContrast,
                          fontSize: '10px',
                          fontWeight: 'bold',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          padding: '0 4px',
                          lineHeight: '1',
                          pointerEvents: 'none',
                        }}
                      >
                        {entry.commitsBehind}
                      </span>
                    ) : null}
                  </div>
                ) : null}
                {/* Logs */}
                <StackCraftNestedRouteLink
                  href="/stacks/:stackName/services/:serviceId/logs"
                  params={{ stackName: entry.stackName, serviceId: entry.id }}
                >
                  <Button
                    variant="text"
                    size="small"
                    title="Logs"
                    aria-label="Logs"
                    startIcon={<Icon icon={icons.fileText} size="small" />}
                  />
                </StackCraftNestedRouteLink>
                {/* Details */}
                <StackCraftNestedRouteLink
                  href="/stacks/:stackName/services/:serviceId"
                  params={{ stackName: entry.stackName, serviceId: entry.id }}
                >
                  <Button
                    variant="text"
                    size="small"
                    title="Details"
                    aria-label="Details"
                    startIcon={<Icon icon={icons.eye} size="small" />}
                  />
                </StackCraftNestedRouteLink>
                {/* Edit */}
                <Button
                  variant="text"
                  size="small"
                  title="Edit"
                  aria-label="Edit"
                  onclick={() =>
                    injector
                      .getInstance(LocationService)
                      .navigate(`/stacks/${entry.stackName}/services/${entry.id}#configuration`)
                  }
                  startIcon={<Icon icon={icons.edit} size="small" />}
                />
              </div>
            )
          },
        }}
      />
    )
  },
})
