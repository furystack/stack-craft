import { useEntitySync } from '@furystack/entity-sync-client'
import { createComponent, Shade } from '@furystack/shades'
import {
  Button,
  Icon,
  icons,
  Loader,
  NotyService,
  PageContainer,
  PageHeader,
  Paper,
} from '@furystack/shades-common-components'
import { Service } from 'common'

import { ServiceForm } from '../../components/entity-forms/service-form.js'
import { ServiceStatusIndicator } from '../../components/service-status-indicator.js'
import { ServicesApiClient } from '../../services/api-clients/services-api-client.js'

type ServiceDetailProps = {
  serviceId: string
}

export const ServiceDetail = Shade<ServiceDetailProps>({
  shadowDomName: 'shade-service-detail',
  render: (options) => {
    const { props, injector, useState } = options
    const [isEditing, setIsEditing] = useState('isEditing', false)

    const serviceState = useEntitySync(options, Service, props.serviceId)

    if (serviceState.status === 'connecting') {
      return (
        <PageContainer>
          <div style={{ display: 'flex', justifyContent: 'center', padding: '48px' }}>
            <Loader />
          </div>
        </PageContainer>
      )
    }

    if (serviceState.status === 'error') {
      return (
        <PageContainer>
          <PageHeader
            title="Error loading service"
            description={serviceState.error}
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

    const service = serviceState.data
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

    const handleSave = async (data: Partial<Service>) => {
      try {
        await api.call({
          method: 'PATCH',
          action: '/services/:id',
          url: { id: service.id },
          body: {
            displayName: data.displayName,
            description: data.description,
            workingDirectory: data.workingDirectory,
            runCommand: data.runCommand,
            installCommand: data.installCommand,
            buildCommand: data.buildCommand,
            autoFetchEnabled: data.autoFetchEnabled,
            autoFetchIntervalMinutes: data.autoFetchIntervalMinutes,
            autoRestartOnFetch: data.autoRestartOnFetch,
          },
        })
        injector.getInstance(NotyService).emit('onNotyAdded', {
          title: 'Service updated',
          body: `"${data.displayName ?? service.displayName}" was updated successfully.`,
          type: 'success',
        })
        setIsEditing(false)
      } catch (error) {
        injector.getInstance(NotyService).emit('onNotyAdded', {
          title: 'Error',
          body: error instanceof Error ? error.message : 'Failed to update service',
          type: 'error',
        })
      }
    }

    if (isEditing) {
      return (
        <PageContainer>
          <PageHeader
            title={`Edit: ${service.displayName}`}
            actions={
              <Button
                variant="outlined"
                onclick={() => setIsEditing(false)}
                startIcon={<Icon icon={icons.chevronLeft} size="small" />}
              >
                Cancel
              </Button>
            }
          />
          <Paper>
            <ServiceForm
              mode="edit"
              stackName={service.stackName}
              initial={service}
              onSubmit={(data) => void handleSave(data)}
              onCancel={() => setIsEditing(false)}
            />
          </Paper>
        </PageContainer>
      )
    }

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
              <Button
                variant="outlined"
                onclick={() => setIsEditing(true)}
                startIcon={<Icon icon={icons.edit} size="small" />}
              >
                Edit
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
