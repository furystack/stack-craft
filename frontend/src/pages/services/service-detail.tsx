import { createComponent, Shade } from '@furystack/shades'
import {
  Button,
  Icon,
  icons,
  Loader,
  PageContainer,
  PageHeader,
  Paper,
} from '@furystack/shades-common-components'
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
      return (
        <PageContainer>
          <div style={{ display: 'flex', justifyContent: 'center', padding: '48px' }}>
            <Loader />
          </div>
        </PageContainer>
      )
    }

    if (!service) {
      return (
        <PageContainer>
          <PageHeader
            title="Service not found"
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
        </PageContainer>
      )
    }

    const api = injector.getInstance(ServicesApiClient)

    return (
      <PageContainer>
        <PageHeader
          title={service.displayName}
          description={service.description}
          actions={
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <ServiceStatusIndicator service={service} />
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
                startIcon={<Icon icon={icons.file} size="small" />}
              >
                View Logs
              </Button>
            </div>
          }
        />
        <Paper>
          <div style={{ display: 'grid', gridTemplateColumns: '200px 1fr', gap: '8px 16px', fontSize: '14px' }}>
            <strong>Working Directory</strong>
            <span style={{ fontFamily: 'monospace' }}>{service.workingDirectory}</span>
            <strong>Run Command</strong>
            <span style={{ fontFamily: 'monospace' }}>{service.runCommand}</span>
            {service.installCommand ? (
              <div style={{ display: 'contents' }}>
                <strong>Install Command</strong>
                <span style={{ fontFamily: 'monospace' }}>{service.installCommand}</span>
              </div>
            ) : null}
            {service.buildCommand ? (
              <div style={{ display: 'contents' }}>
                <strong>Build Command</strong>
                <span style={{ fontFamily: 'monospace' }}>{service.buildCommand}</span>
              </div>
            ) : null}
            <strong>Install Status</strong>
            <span>{service.installStatus}</span>
            <strong>Build Status</strong>
            <span>{service.buildStatus}</span>
            <strong>Run Status</strong>
            <span>{service.runStatus}</span>
          </div>
        </Paper>
      </PageContainer>
    )
  },
})
