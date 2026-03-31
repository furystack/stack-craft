import { createComponent, Shade } from '@furystack/shades'
import { Button, Icon, icons, NotyService, Paper } from '@furystack/shades-common-components'

import { StackCraftNestedRouteLink } from '../../../components/app-routes.js'
import { LogViewer } from '../../../components/shared/log-viewer.js'
import { ServicesApiClient } from '../../../services/api-clients/services-api-client.js'

/* ============================================
 * Logs Tab
 * ============================================ */

type LogsTabProps = {
  serviceId: string
  stackName: string
}

export const LogsTab = Shade<LogsTabProps>({
  customElementName: 'shade-service-logs-tab',
  render: ({ props, injector }) => {
    const api = injector.getInstance(ServicesApiClient)
    const noty = injector.getInstance(NotyService)

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
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ margin: '0' }}>Service Logs</h3>
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
            <StackCraftNestedRouteLink
              href="/stacks/:stackName/services/:serviceId/logs"
              params={{ stackName: props.stackName, serviceId: props.serviceId }}
            >
              <Button variant="outlined" size="small" startIcon={<Icon icon={icons.externalLink} size="small" />}>
                Full View
              </Button>
            </StackCraftNestedRouteLink>
          </div>
        </div>
        <Paper style={{ height: 'clamp(300px, 50vh, 600px)', overflow: 'hidden' }}>
          <LogViewer serviceId={props.serviceId} />
        </Paper>
      </div>
    )
  },
})
