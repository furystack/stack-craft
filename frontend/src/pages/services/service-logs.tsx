import { createComponent, Shade } from '@furystack/shades'
import { Button, Icon, icons, PageHeader } from '@furystack/shades-common-components'

import { LogViewer } from '../../components/log-viewer.js'

type ServiceLogsProps = {
  serviceId: string
}

export const ServiceLogs = Shade<ServiceLogsProps>({
  shadowDomName: 'shade-service-logs',
  render: ({ props }) => {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
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
        <div style={{ flex: '1', overflow: 'hidden' }}>
          <LogViewer serviceId={props.serviceId} />
        </div>
      </div>
    )
  },
})
