import { createComponent, Shade } from '@furystack/shades'
import { Button, Icon, icons, NotyService, PageContainer, PageHeader, Paper } from '@furystack/shades-common-components'

import { LogViewer } from '../../components/log-viewer.js'
import { ServicesApiClient } from '../../services/api-clients/services-api-client.js'

type ServiceLogsProps = {
  serviceId: string
  processUid?: string
}

export const ServiceLogs = Shade<ServiceLogsProps>({
  shadowDomName: 'shade-service-logs',
  render: ({ props, injector }) => {
    const api = injector.getInstance(ServicesApiClient)
    const notyService = injector.getInstance(NotyService)

    const handleClearLogs = async () => {
      try {
        await api.call({
          method: 'DELETE',
          action: '/services/:id/logs',
          url: { id: props.serviceId },
        })
        notyService.emit('onNotyAdded', {
          title: 'Logs cleared',
          body: 'Service logs have been cleared.',
          type: 'success',
        })
      } catch (error) {
        notyService.emit('onNotyAdded', {
          title: 'Error',
          body: error instanceof Error ? error.message : 'Failed to clear logs',
          type: 'error',
        })
      }
    }

    return (
      <PageContainer>
        <PageHeader
          icon="📋"
          title={props.processUid ? 'Process Logs' : 'Service Logs'}
          actions={
            <div style={{ display: 'flex', gap: '8px' }}>
              {!props.processUid && (
                <Button
                  variant="outlined"
                  color="error"
                  onclick={() => void handleClearLogs()}
                  startIcon={<Icon icon={icons.trash} size="small" />}
                >
                  Clear Logs
                </Button>
              )}
              <Button
                variant="outlined"
                onclick={() => history.back()}
                startIcon={<Icon icon={icons.chevronLeft} size="small" />}
              >
                Back
              </Button>
            </div>
          }
        />
        <Paper style={{ flex: '1', overflow: 'hidden' }}>
          <LogViewer serviceId={props.serviceId} processUid={props.processUid} />
        </Paper>
      </PageContainer>
    )
  },
})
