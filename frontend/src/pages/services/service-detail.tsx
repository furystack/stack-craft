import { createComponent, Shade } from '@furystack/shades'
import { Button } from '@furystack/shades-common-components'
import type { Service } from 'common'
import { ServicesApiClient } from '../../services/api-clients/services-api-client.js'
import { ServiceStatusIndicator } from '../../components/service-status-indicator.js'

type ServiceDetailProps = {
  serviceId: string
}

export const ServiceDetail = Shade<ServiceDetailProps>({
  shadowDomName: 'shade-service-detail',
  render: ({ props, injector, useState }) => {
    const [service, setService] = useState<Service | null>('service', null)
    const [isLoading, setIsLoading] = useState('isLoading', true)

    if (isLoading && !service) {
      const api = injector.getInstance(ServicesApiClient)
      api
        .call({
          method: 'GET',
          action: '/services/:id',
          url: { id: props.serviceId },
          query: {},
        })
        .then(({ result }) => {
          setService(result)
          setIsLoading(false)
        })
        .catch(() => setIsLoading(false))
    }

    if (isLoading) {
      return <div style={{ padding: '24px' }}>Loading...</div>
    }

    if (!service) {
      return <div style={{ padding: '24px' }}>Service not found.</div>
    }

    const api = injector.getInstance(ServicesApiClient)

    return (
      <div style={{ padding: '24px', maxWidth: '800px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '24px' }}>
          <h2 style={{ margin: '0' }}>{service.displayName}</h2>
          <ServiceStatusIndicator service={service} />
        </div>
        {service.description ? <p style={{ opacity: '0.7', marginBottom: '24px' }}>{service.description}</p> : null}
        <div style={{ display: 'flex', gap: '8px', marginBottom: '24px' }}>
          {service.runStatus !== 'running' ? (
            <Button
              variant="contained"
              color="success"
              onclick={() => {
                void api.call({ method: 'POST', action: '/services/:id/start', url: { id: service.id } })
              }}
            >
              Start
            </Button>
          ) : (
            <Button
              variant="outlined"
              onclick={() => {
                void api.call({ method: 'POST', action: '/services/:id/stop', url: { id: service.id } })
              }}
            >
              Stop
            </Button>
          )}
          <Button
            variant="outlined"
            onclick={() => {
              void api.call({ method: 'POST', action: '/services/:id/restart', url: { id: service.id } })
            }}
          >
            Restart
          </Button>
          <Button
            variant="outlined"
            onclick={() => history.pushState(null, '', `/services/${service.id}/logs`)}
          >
            View Logs
          </Button>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '200px 1fr', gap: '8px 16px', fontSize: '14px' }}>
          <strong>Working Directory</strong>
          <span style={{ fontFamily: 'monospace' }}>{service.workingDirectory}</span>
          <strong>Run Command</strong>
          <span style={{ fontFamily: 'monospace' }}>{service.runCommand}</span>
          {service.installCommand ? (
            <strong>Install Command</strong>
          ) : null}
          {service.installCommand ? (
            <span style={{ fontFamily: 'monospace' }}>{service.installCommand}</span>
          ) : null}
          {service.buildCommand ? (
            <strong>Build Command</strong>
          ) : null}
          {service.buildCommand ? (
            <span style={{ fontFamily: 'monospace' }}>{service.buildCommand}</span>
          ) : null}
          <strong>Install Status</strong>
          <span>{service.installStatus}</span>
          <strong>Build Status</strong>
          <span>{service.buildStatus}</span>
          <strong>Run Status</strong>
          <span>{service.runStatus}</span>
        </div>
      </div>
    )
  },
})
