import { useCollectionSync, useEntitySync } from '@furystack/entity-sync-client'
import type { Injector } from '@furystack/inject'
import { createComponent, LocationService, NestedRouteLink, Shade } from '@furystack/shades'

import { navigate } from '../../utils/navigate.js'
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
import { GitHubRepository, ServiceDefinition, StackDefinition } from 'common'
import type { ServiceStateHistory, ServiceView, StackView } from 'common'
import { getServiceCwd } from 'common'

import { ConfirmDialog } from '../../components/confirm-dialog.js'
import { ServiceForm } from '../../components/entity-forms/service-form.js'
import { ServiceStatusIndicator } from '../../components/service-status-indicator.js'
import { ServicesApiClient } from '../../services/api-clients/services-api-client.js'

const eventLabels: Record<string, string> = {
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
  'pull-completed': 'Pull completed',
}

type ServiceDetailProps = {
  serviceId: string
}

export const ServiceDetail = Shade<ServiceDetailProps>({
  shadowDomName: 'shade-service-detail',
  render: (options) => {
    const { props, injector, useState } = options
    const locationService = injector.getInstance(LocationService)
    const searchState = locationService.onDeserializedLocationSearchChanged.getValue()
    const hasEditParam = searchState.edit === true
    const [isEditing, setIsEditing] = useState('isEditing', hasEditParam)
    const [isConfirmingDelete, setIsConfirmingDelete] = useState('isConfirmingDelete', false)

    const serviceState = useEntitySync(options, ServiceDefinition, props.serviceId)

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

    const service = serviceState.data as ServiceView | undefined
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

    const stackState = useEntitySync(options, StackDefinition, service.stackName)
    const reposState = useCollectionSync(options, GitHubRepository, {
      filter: { stackName: { $eq: service.stackName } },
    })
    const repos = reposState.status === 'synced' || reposState.status === 'cached' ? reposState.data : []
    const linkedRepo = service.repositoryId ? repos.find((r) => r.id === service.repositoryId) : undefined
    const stack = stackState.status === 'synced' ? (stackState.data as StackView | undefined) : undefined
    const fullCwd = stack ? getServiceCwd(stack, service, linkedRepo ?? null) : null

    const api = injector.getInstance(ServicesApiClient)

    const handleSave = async (data: Partial<ServiceView>) => {
      try {
        await api.call({
          method: 'PATCH',
          action: '/services/:id',
          url: { id: service.id },
          body: {
            displayName: data.displayName,
            description: data.description,
            workingDirectory: data.workingDirectory,
            repositoryId: data.repositoryId,
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

    const handleDelete = async () => {
      try {
        await api.call({
          method: 'DELETE',
          action: '/services/:id',
          url: { id: service.id },
        })
        injector.getInstance(NotyService).emit('onNotyAdded', {
          title: 'Service deleted',
          body: `"${service.displayName}" was deleted.`,
          type: 'success',
        })
        navigate(injector, '/')
      } catch (error) {
        injector.getInstance(NotyService).emit('onNotyAdded', {
          title: 'Error',
          body: error instanceof Error ? error.message : 'Failed to delete service',
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
              repositories={repos}
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
                onclick={() => navigate(injector, `/services/${service.id}/logs`)}
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
              <Button variant="outlined" color="error" onclick={() => setIsConfirmingDelete(true)}>
                Delete
              </Button>
            </div>
          }
        />
        <Paper>
          <div style={{ display: 'grid', gridTemplateColumns: '200px 1fr', gap: '8px 16px', fontSize: '14px' }}>
            {linkedRepo ? (
              <div style={{ display: 'contents' }}>
                <strong>Repository</strong>
                <span>
                  <NestedRouteLink href="/repositories/:id" params={{ id: linkedRepo.id }} style={{ color: 'inherit' }}>
                    {linkedRepo.displayName}
                  </NestedRouteLink>
                </span>
              </div>
            ) : null}
            <strong>Working Directory</strong>
            <span style={{ fontFamily: 'monospace' }}>{fullCwd ?? '(loading…)'}</span>
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
        <ServiceHistory serviceId={service.id} injector={injector} />
        {isConfirmingDelete ? (
          <ConfirmDialog
            title="Delete Service"
            message={`Are you sure you want to delete "${service.displayName}"? This action cannot be undone.`}
            confirmLabel="Delete"
            variant="danger"
            onConfirm={() => void handleDelete()}
            onCancel={() => setIsConfirmingDelete(false)}
          />
        ) : null}
      </PageContainer>
    )
  },
})

type ServiceHistoryProps = {
  serviceId: string
  injector: Injector
}

const ServiceHistory = Shade<ServiceHistoryProps>({
  shadowDomName: 'shade-service-history',
  render: ({ props, useState }) => {
    const [entries, setEntries] = useState<ServiceStateHistory[]>('entries', [])
    const [isLoading, setIsLoading] = useState('isLoading', true)

    if (isLoading && entries.length === 0) {
      props.injector
        .getInstance(ServicesApiClient)
        .call({
          method: 'GET',
          action: '/services/:id/history',
          url: { id: props.serviceId },
          query: { limit: 50 },
        })
        .then(({ result }) => {
          setEntries(result.entries)
          setIsLoading(false)
        })
        .catch(() => setIsLoading(false))
    }

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
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '180px 160px 120px 120px 1fr',
              gap: '4px 12px',
              fontSize: '13px',
            }}
          >
            <strong>Time</strong>
            <strong>Event</strong>
            <strong>Triggered by</strong>
            <strong>Source</strong>
            <strong>Details</strong>
            {entries.map((entry) => (
              <div style={{ display: 'contents' }}>
                <span>{new Date(entry.createdAt).toLocaleString()}</span>
                <span>{eventLabels[entry.event] ?? entry.event}</span>
                <span>{entry.triggeredBy}</span>
                <span>{entry.triggerSource}</span>
                <span style={{ fontFamily: 'monospace', fontSize: '12px', opacity: '0.8' }}>
                  {entry.metadata ?? ''}
                </span>
              </div>
            ))}
          </div>
        )}
      </Paper>
    )
  },
})
