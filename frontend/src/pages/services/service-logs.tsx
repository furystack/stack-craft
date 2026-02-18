import { createComponent, Shade } from '@furystack/shades'
import { Button, Icon, icons, PageContainer, PageHeader, Paper } from '@furystack/shades-common-components'

import { LogViewer } from '../../components/log-viewer.js'

type ServiceLogsProps = {
  serviceId: string
}

export const ServiceLogs = Shade<ServiceLogsProps>({
  shadowDomName: 'shade-service-logs',
  render: ({ props }) => {
    return (
      <PageContainer>
        <PageHeader
          icon="📋"
          title="Service Logs"
          actions={
            <Button
              variant="outlined"
              onclick={() => history.back()}
              startIcon={<Icon icon={icons.chevronLeft} size="small" />}
            >
              Back
            </Button>
          }
        />
        <Paper style={{ flex: '1', overflow: 'hidden' }}>
          <LogViewer serviceId={props.serviceId} />
        </Paper>
      </PageContainer>
    )
  },
})
