import type { FindOptions } from '@furystack/core'
import { useCollectionSync } from '@furystack/entity-sync-client'
import { serializeToQueryString } from '@furystack/rest'
import { createComponent, LocationService, Shade } from '@furystack/shades'
import type { ColumnFilterConfig } from '@furystack/shades-common-components'
import {
  Button,
  Chip,
  CollectionService,
  cssVariableTheme,
  DataGrid,
  Icon,
  icons,
  MarkdownDisplay,
  SelectionCell,
} from '@furystack/shades-common-components'
import type { PrerequisiteCheckStatus, ServiceView } from 'common'
import { PrerequisiteCheckResult } from 'common'

import { ServicesApiClient } from '../services/api-clients/services-api-client.js'
import { applyClientFindOptions } from '../utils/apply-client-find-options.js'
import { getPrimaryAction } from '../utils/service-pipeline.js'
import { StackCraftNestedRouteLink } from './app-routes.js'
import { BranchSelector } from './branch-selector.js'
import { MiniPipelineDots } from './mini-pipeline-dots.js'

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
    const { props, injector, useDisposable, useObservable, useState } = options
    const api = injector.getInstance(ServicesApiClient)

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
          displayName: (entry) => {
            const summary = getPrereqSummary(entry.prerequisiteIds)
            return (
              <span>
                <strong>{entry.displayName}</strong>
                {entry.description ? (
                  <div style={{ fontSize: cssVariableTheme.typography.fontSize.sm, opacity: '0.6', marginTop: '2px' }}>
                    <MarkdownDisplay content={entry.description} />
                  </div>
                ) : null}
                {summary ? (
                  <div style={{ marginTop: '4px' }}>
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
                  </div>
                ) : null}
              </span>
            )
          },
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
                    onclick={() => {
                      void api.call({
                        method: 'POST',
                        action: primary.apiAction as '/services/:id/start',
                        url: { id: entry.id },
                      })
                    }}
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
                    onclick={() => {
                      void api.call({ method: 'POST', action: '/services/:id/restart', url: { id: entry.id } })
                    }}
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
                      onclick={() => {
                        void api.call({ method: 'POST', action: '/services/:id/update', url: { id: entry.id } })
                      }}
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
                    startIcon={<Icon icon={icons.eye} size="small" />}
                  />
                </StackCraftNestedRouteLink>
                {/* Edit */}
                <Button
                  variant="text"
                  size="small"
                  title="Edit"
                  onclick={() =>
                    injector
                      .getInstance(LocationService)
                      .navigate(
                        `/stacks/${entry.stackName}/services/${entry.id}?${serializeToQueryString({ edit: true })}`,
                      )
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
