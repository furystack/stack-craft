import type { FindOptions } from '@furystack/core'
import { createComponent, Shade } from '@furystack/shades'
import {
  Button,
  type CollectionService,
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
import { stackCraftNavigate, StackCraftNestedRouteLink } from './app-routes.js'
import { BranchSelector } from './branch-selector.js'
import { MiniPipelineDots } from './mini-pipeline-dots.js'
import { PrerequisiteSummaryChip } from './prerequisite-summary-chip.js'
import { ServiceWarnings } from './service-warnings.js'

type ServiceTableProps = {
  services: ServiceView[]
  collectionService: CollectionService<ServiceView>
}

type ServiceColumn = 'selection' | 'displayName' | 'pipeline' | 'branch' | 'actions'

export const ServiceTable = Shade<ServiceTableProps>({
  customElementName: 'shade-service-table',
  render: (options) => {
    const { props, injector, useState, useDisposable } = options
    const api = injector.get(ServicesApiClient)
    const noty = injector.get(NotyService)
    const { collectionService } = props

    useDisposable(
      'service-table-row-dblclick',
      () =>
        collectionService.subscribe('onRowDoubleClick', (entry) => {
          stackCraftNavigate(injector, {
            path: '/stacks/:stackName/services/:serviceId',
            params: { stackName: entry.stackName, serviceId: entry.id },
          })
        }),
      [collectionService],
    )

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

    const [findOptions, setFindOptions] = useState<FindOptions<ServiceView, Array<keyof ServiceView>>>(
      'findOptionsObservable',
      { top: 25 },
    )

    const { entries, count } = applyClientFindOptions(props.services, findOptions)

    const currentData = collectionService.data.getValue()
    const currentEntryById = new Map(currentData.entries.map((e) => [e.id, e]))
    const stableEntries = entries.map((entry) => {
      const existing = currentEntryById.get(entry.id)
      if (existing && JSON.stringify(existing) === JSON.stringify(entry)) return existing
      return entry
    })

    if (
      stableEntries.length !== currentData.entries.length ||
      stableEntries.some((e, i) => e !== currentData.entries[i])
    ) {
      collectionService.data.setValue({ entries: stableEntries, count })
    }

    return (
      <DataGrid<ServiceView, ServiceColumn>
        columns={['selection', 'displayName', 'pipeline', 'branch', 'actions']}
        findOptions={findOptions}
        onFindOptionsChange={setFindOptions}
        styles={undefined}
        collectionService={collectionService}
        headerComponents={{
          selection: () => <span />,
          displayName: () => {
            const { order } = findOptions
            const currentDir = order?.displayName
            const nextDir = currentDir === 'ASC' ? 'DESC' : 'ASC'

            return (
              <span
                style={{ display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer', userSelect: 'none' }}
                onclick={() => setFindOptions({ ...findOptions, order: { displayName: nextDir } })}
              >
                Service
                <Icon
                  icon={
                    currentDir === 'ASC' ? icons.arrowDown : currentDir === 'DESC' ? icons.arrowUp : icons.arrowUpDown
                  }
                  size={14}
                  style={{ opacity: currentDir ? '1' : '0.4' }}
                />
              </span>
            )
          },
          pipeline: () => <span>Status</span>,
          branch: () => <span>Branch</span>,
          actions: () => <span style={{ paddingLeft: '1em' }}>Actions</span>,
        }}
        rowComponents={{
          selection: (entry) => <SelectionCell entry={entry} service={collectionService} />,
          displayName: (entry) => (
            <span>
              <StackCraftNestedRouteLink
                path="/stacks/:stackName/services/:serviceId"
                params={{ stackName: entry.stackName, serviceId: entry.id }}
                style={{ color: 'inherit', textDecoration: 'none' }}
              >
                <strong>{entry.displayName}</strong>
              </StackCraftNestedRouteLink>
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
              <ServiceWarnings service={entry} />
            </span>
          ),
          pipeline: (entry) => <MiniPipelineDots service={entry} />,
          branch: (entry) => (
            <div onclick={(e: MouseEvent) => e.stopPropagation()}>
              <BranchSelector
                serviceId={entry.id}
                currentBranch={entry.currentBranch}
                cloneStatus={entry.cloneStatus}
                upstreamStatus={entry.upstreamStatus}
                lastPullError={entry.lastPullError}
                commitsBehind={entry.commitsBehind}
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
                {primary.apiAction ? (
                  <Button
                    variant="text"
                    size="small"
                    color={primary.color === 'secondary' ? undefined : primary.color}
                    title={primary.label}
                    aria-label={primary.label}
                    onclick={() => callServiceAction(entry.id, primary.apiAction.split('/').pop()!, primary.label)}
                    startIcon={primary.icon || <Icon icon={icons.play} size="small" />}
                  />
                ) : null}
                <StackCraftNestedRouteLink
                  path="/stacks/:stackName/services/:serviceId"
                  params={{ stackName: entry.stackName, serviceId: entry.id }}
                  hash="logs"
                >
                  <Button
                    variant="text"
                    size="small"
                    title="Logs"
                    aria-label="Logs"
                    startIcon={<Icon icon={icons.fileText} size="small" />}
                  />
                </StackCraftNestedRouteLink>
                <StackCraftNestedRouteLink
                  path="/stacks/:stackName/services/:serviceId"
                  params={{ stackName: entry.stackName, serviceId: entry.id }}
                >
                  <Button
                    variant="text"
                    size="small"
                    title="Details"
                    aria-label="Details"
                    startIcon={<Icon icon={icons.chevronRight} size="small" />}
                  />
                </StackCraftNestedRouteLink>
              </div>
            )
          },
        }}
      />
    )
  },
})
