import { createComponent, Shade } from '@furystack/shades'
import { Button } from '@furystack/shades-common-components'
import { LogViewer } from '../../components/log-viewer.js'

type ServiceLogsProps = {
  serviceId: string
}

export const ServiceLogs = Shade<ServiceLogsProps>({
  shadowDomName: 'shade-service-logs',
  render: ({ props }) => {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 64px)' }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '16px',
            padding: '12px 24px',
            borderBottom: '1px solid rgba(255,255,255,0.08)',
          }}
        >
          <Button variant="outlined" onclick={() => history.back()}>
            Back
          </Button>
          <h3 style={{ margin: '0' }}>Service Logs</h3>
        </div>
        <LogViewer serviceId={props.serviceId} />
      </div>
    )
  },
})
