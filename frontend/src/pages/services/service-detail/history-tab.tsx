import type { FindOptions } from '@furystack/core'
import { useCollectionSync } from '@furystack/entity-sync-client'
import { createComponent, Shade } from '@furystack/shades'
import type { ColumnFilterConfig } from '@furystack/shades-common-components'
import {
  Button,
  CollectionService,
  cssVariableTheme,
  DataGrid,
  Loader,
  Paper,
} from '@furystack/shades-common-components'
import { ServiceStateHistory } from 'common'

import { stackCraftNavigate } from '../../../components/app-routes.js'

/* ============================================
 * History Tab
 * ============================================ */

const eventLabels: Record<string, string> = {
  'clone-started': 'Clone started',
  'clone-completed': 'Clone completed',
  'clone-failed': 'Clone failed',
  'run-started': 'Started',
  'run-stopped': 'Stopped',
  'run-crashed': 'Crashed',
  'run-restarted': 'Restarted',
  'install-started': 'Install started',
  'install-completed': 'Install completed',
  'install-failed': 'Install failed',
  'build-started': 'Build started',
  'build-completed': 'Build completed',
  'build-failed': 'Build failed',
  'setup-started': 'Setup started',
  'setup-completed': 'Setup completed',
  'setup-failed': 'Setup failed',
  'update-started': 'Update started',
  'update-completed': 'Update completed',
  'update-failed': 'Update failed',
  'pull-completed': 'Pull completed',
  imported: 'Imported',
}

type ServiceHistoryProps = {
  serviceId: string
  stackName: string
}

type HistoryColumn = 'createdAt' | 'event' | 'triggeredBy' | 'triggerSource' | 'metadata' | 'processUid'

const historyEventValues = Object.entries(eventLabels).map(([value, label]) => ({ value, label }))

const historyColumnFilters: { [K in HistoryColumn]?: ColumnFilterConfig } = {
  event: { type: 'enum', values: historyEventValues },
  triggeredBy: { type: 'string' },
  triggerSource: {
    type: 'enum',
    values: [
      { label: 'API', value: 'api' },
      { label: 'MCP', value: 'mcp' },
      { label: 'Auto-fetch', value: 'auto-fetch' },
      { label: 'Auto-restart', value: 'auto-restart' },
      { label: 'System', value: 'system' },
    ],
  },
  createdAt: { type: 'date' },
}

export const ServiceHistory = Shade<ServiceHistoryProps>({
  customElementName: 'shade-service-history',
  render: (options) => {
    const { props, injector, useDisposable, useState } = options

    const collectionService = useDisposable(
      'collectionService',
      () => new CollectionService<ServiceStateHistory>({ searchField: 'event' }),
    )

    const [findOptions, setFindOptions] = useState<FindOptions<ServiceStateHistory, Array<keyof ServiceStateHistory>>>(
      'findOptionsObservable',
      {
        top: 25,
        order: { id: 'DESC' },
      },
    )

    const historyState = useCollectionSync(options, ServiceStateHistory, {
      filter: { serviceId: { $eq: props.serviceId }, ...findOptions.filter },
      order: findOptions.order ?? { id: 'DESC' },
      top: findOptions.top,
      skip: findOptions.skip,
    })

    const isLoading = historyState.status === 'connecting'
    const entries =
      historyState.status === 'synced' || historyState.status === 'cached' ? historyState.data.entries : []
    const count = historyState.status === 'synced' || historyState.status === 'cached' ? historyState.data.count : 0

    collectionService.data.setValue({ entries, count })

    return (
      <Paper>
        <h3 style={{ margin: '0 0 12px 0' }}>History</h3>
        {isLoading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '24px' }}>
            <Loader />
          </div>
        ) : entries.length === 0 ? (
          <div style={{ opacity: '0.6', padding: '12px 0' }}>No history entries yet.</div>
        ) : (
          <DataGrid<ServiceStateHistory, HistoryColumn>
            columns={['createdAt', 'event', 'triggeredBy', 'triggerSource', 'metadata', 'processUid']}
            findOptions={findOptions}
            onFindOptionsChange={setFindOptions}
            styles={undefined}
            collectionService={collectionService}
            columnFilters={historyColumnFilters}
            headerComponents={{
              createdAt: () => <span>Time</span>,
              event: () => <span>Event</span>,
              triggeredBy: () => <span>Triggered by</span>,
              triggerSource: () => <span>Source</span>,
              metadata: () => <span>Details</span>,
              processUid: () => <span>Logs</span>,
            }}
            rowComponents={{
              createdAt: (entry) => <span>{new Date(entry.createdAt).toLocaleString()}</span>,
              event: (entry) => <span>{eventLabels[entry.event] ?? entry.event}</span>,
              triggeredBy: (entry) => <span>{entry.triggeredBy}</span>,
              triggerSource: (entry) => <span>{entry.triggerSource}</span>,
              metadata: (entry) => (
                <span
                  style={{ fontFamily: 'monospace', fontSize: cssVariableTheme.typography.fontSize.sm, opacity: '0.8' }}
                >
                  {entry.metadata ?? ''}
                </span>
              ),
              processUid: (entry) => {
                const { processUid } = entry
                if (!processUid) return <span />
                return (
                  <Button
                    size="small"
                    onclick={() =>
                      stackCraftNavigate(injector, '/stacks/:stackName/services/:serviceId/logs/:processUid', {
                        stackName: props.stackName,
                        serviceId: props.serviceId,
                        processUid,
                      })
                    }
                  >
                    Show Logs
                  </Button>
                )
              },
            }}
          />
        )}
      </Paper>
    )
  },
})
