import { createComponent, Shade } from '@furystack/shades'
import { Button, Icon, icons, NotyService, Paper } from '@furystack/shades-common-components'

import { LogViewer } from '../../../components/shared/log-viewer.js'
import { ServicesApiClient } from '../../../services/api-clients/services-api-client.js'

/* ============================================
 * Logs Tab
 * ============================================ */

type LogsTabProps = {
  serviceId: string
  stackName: string
  processUid?: string
}

export const LogsTab = Shade<LogsTabProps>({
  customElementName: 'shade-service-logs-tab',
  render: ({ props, injector }) => {
    const api = injector.get(ServicesApiClient)
    const noty = injector.get(NotyService)

    const handleClearLogs = async () => {
      try {
        await api.call({
          method: 'DELETE',
          action: '/services/:id/logs',
          url: { id: props.serviceId },
        })
        noty.emit('onNotyAdded', {
          title: 'Logs cleared',
          body: 'Service logs have been cleared.',
          type: 'success',
        })
      } catch (error) {
        noty.emit('onNotyAdded', {
          title: 'Error',
          body: error instanceof Error ? error.message : 'Failed to clear logs',
          type: 'error',
        })
      }
    }

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', flex: '1', minHeight: '0' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ margin: '0' }}>{props.processUid ? 'Process Logs' : 'Service Logs'}</h3>
          {!props.processUid ? (
            <div style={{ display: 'flex', gap: '8px' }}>
              <Button
                variant="outlined"
                size="small"
                color="error"
                onclick={() => void handleClearLogs()}
                startIcon={<Icon icon={icons.trash} size="small" />}
              >
                Clear Logs
              </Button>
            </div>
          ) : null}
        </div>
        <Paper style={{ flex: '1', minHeight: '0', overflow: 'hidden' }}>
          <LogViewer serviceId={props.serviceId} processUid={props.processUid} />
        </Paper>
      </div>
    )
  },
})
