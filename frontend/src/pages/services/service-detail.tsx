import type { FindOptions } from '@furystack/core'
import { useCollectionSync, useEntitySync } from '@furystack/entity-sync-client'
import { createComponent, LocationService, NestedRouteLink, Shade } from '@furystack/shades'
import type { ColumnFilterConfig } from '@furystack/shades-common-components'
import {
  Button,
  CollectionService,
  DataGrid,
  Icon,
  icons,
  Loader,
  MarkdownDisplay,
  NotyService,
  PageContainer,
  PageHeader,
  Paper,
} from '@furystack/shades-common-components'
import { ObservableValue } from '@furystack/utils'
import type { ServiceView, StackView } from 'common'
import {
  getServiceCwd,
  GitHubRepository,
  ServiceConfig,
  ServiceDefinition,
  ServiceStateHistory,
  ServiceStatus,
  StackConfig,
  StackDefinition,
} from 'common'

import { navigate } from '../../utils/navigate.js'

import { ConfirmDialog } from '../../components/confirm-dialog.js'
import { ServiceForm } from '../../components/entity-forms/service-form.js'
import { ServiceStatusIndicator } from '../../components/service-status-indicator.js'
import {
  BuildStatusChip,
  CloneStatusChip,
  InstallStatusChip,
  RunStatusChip,
} from '../../components/status-chips.js'
import { ServicesApiClient } from '../../services/api-clients/services-api-client.js'

const eventLabels: Record<string, string> = {
  'clone-started': 'Clone started',
  'clone-completed': 'Clone completed',
  'clone-failed': 'Clone failed',
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
  'setup-started': 'Setup started',
  'setup-completed': 'Setup completed',
  'setup-failed': 'Setup failed',
  'update-started': 'Update started',
  'update-completed': 'Update completed',
  'update-failed': 'Update failed',
  'pull-completed': 'Pull completed',
  imported: 'Imported',
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
    const statusState = useEntitySync(options, ServiceStatus, props.serviceId)
    const configState = useEntitySync(options, ServiceConfig, props.serviceId)

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

    const serviceData = serviceState.data
    if (!serviceData) {
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

    const statusData = statusState.status === 'synced' ? statusState.data : undefined
    const configData = configState.status === 'synced' ? configState.data : undefined

    const service: ServiceView = {
      serviceId: serviceData.id,
      autoFetchEnabled: false,
      autoFetchIntervalMinutes: 60,
      autoRestartOnFetch: false,
      cloneStatus: 'not-cloned',
      installStatus: 'not-installed',
      buildStatus: 'not-built',
      runStatus: 'stopped',
      ...serviceData,
      ...(configData ?? {}),
      ...(statusData ?? {}),
    }

    const stackState = useEntitySync(options, StackDefinition, service.stackName)
    const stackConfigState = useEntitySync(options, StackConfig, service.stackName)
    const reposState = useCollectionSync(options, GitHubRepository, {
      filter: { stackName: { $eq: service.stackName } },
    })
    const repos = reposState.status === 'synced' || reposState.status === 'cached' ? reposState.data.entries : []
    const linkedRepo = service.repositoryId ? repos.find((r) => r.id === service.repositoryId) : undefined
    const stackDef = stackState.status === 'synced' ? stackState.data : undefined
    const stackConfig = stackConfigState.status === 'synced' ? stackConfigState.data : undefined
    const stack = stackDef
      ? ({
          ...stackDef,
          stackName: stackDef.name,
          mainDirectory: stackConfig?.mainDirectory ?? '',
        } as StackView)
      : undefined
    const fullCwd = stack ? getServiceCwd(stack, service, linkedRepo ?? null) : null

    const api = injector.getInstance(ServicesApiClient)
    const [actionInProgress, setActionInProgress] = useState<string | null>('actionInProgress', null)

    const runAction = async (action: string, apiAction: string) => {
      setActionInProgress(action)
      try {
        await api.call({
          method: 'POST',
          action: apiAction as '/services/:id/start',
          url: { id: service.id },
        })
      } catch {
        // Failures surfaced via entity-sync
      } finally {
        setActionInProgress(null)
      }
    }

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
          actions={
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              <ServiceStatusIndicator service={service} />
              <NestedRouteLink href={`/services/${service.id}/logs`}>
                <Button variant="outlined" size="small" startIcon={<Icon icon={icons.file} size="small" />}>
                  Logs
                </Button>
              </NestedRouteLink>
              <Button
                variant="outlined"
                size="small"
                onclick={() => setIsEditing(true)}
                startIcon={<Icon icon={icons.edit} size="small" />}
              >
                Edit
              </Button>
              <Button
                variant="outlined"
                size="small"
                color="error"
                onclick={() => setIsConfirmingDelete(true)}
                startIcon={<Icon icon={icons.trash} size="small" />}
              >
                Delete
              </Button>
            </div>
          }
        />
        {service.description ? (
          <Paper>
            <MarkdownDisplay content={service.description} />
          </Paper>
        ) : null}
        <Paper>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '200px 1fr auto',
              gap: '8px 16px',
              fontSize: '14px',
              alignItems: 'center',
            }}
          >
            {linkedRepo ? (
              <div style={{ display: 'contents' }}>
                <strong>Repository</strong>
                <span>
                  <NestedRouteLink href="/repositories/:id" params={{ id: linkedRepo.id }} style={{ color: 'inherit' }}>
                    {linkedRepo.displayName}
                  </NestedRouteLink>
                </span>
                <span>
                  {linkedRepo.url ? (
                    <a href={linkedRepo.url} target="_blank" rel="noopener noreferrer" style={{ color: 'inherit' }}>
                      <Button variant="outlined" size="small" startIcon={<Icon icon={icons.externalLink} size="small" />}>
                        Open
                      </Button>
                    </a>
                  ) : null}
                </span>
              </div>
            ) : null}
            <strong>Working Directory</strong>
            <span style={{ fontFamily: 'monospace' }}>{fullCwd ?? '(loading…)'}</span>
            {fullCwd ? (
              <span style={{ display: 'flex', gap: '4px' }}>
                <a href={`cursor://file/${fullCwd}`} style={{ color: 'inherit' }}>
                  <Button variant="outlined" size="small" title="Open in Cursor">
                    Cursor
                  </Button>
                </a>
                <a href={`vscode://file/${fullCwd}`} style={{ color: 'inherit' }}>
                  <Button variant="outlined" size="small" title="Open in VS Code">
                    VS Code
                  </Button>
                </a>
              </span>
            ) : (
              <span />
            )}
            {service.repositoryId ? (
              <div style={{ display: 'contents' }}>
                <strong>Clone</strong>
                <CloneStatusChip status={service.cloneStatus} />
                <Button
                  variant="outlined"
                  size="small"
                  loading={actionInProgress === 'pull'}
                  disabled={!!actionInProgress}
                  onclick={() => void runAction('pull', '/services/:id/pull')}
                  startIcon={<Icon icon={icons.download} size="small" />}
                >
                  {service.cloneStatus === 'not-cloned' ? 'Clone' : 'Pull'}
                </Button>
              </div>
            ) : null}
            {service.installCommand ? (
              <div style={{ display: 'contents' }}>
                <strong>Install</strong>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontFamily: 'monospace' }}>{service.installCommand}</span>
                  <InstallStatusChip status={service.installStatus} />
                </div>
                <Button
                  variant="outlined"
                  size="small"
                  loading={actionInProgress === 'install'}
                  disabled={!!actionInProgress}
                  onclick={() => void runAction('install', '/services/:id/install')}
                  startIcon={<Icon icon={icons.packageIcon} size="small" />}
                >
                  Install
                </Button>
              </div>
            ) : null}
            {service.buildCommand ? (
              <div style={{ display: 'contents' }}>
                <strong>Build</strong>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontFamily: 'monospace' }}>{service.buildCommand}</span>
                  <BuildStatusChip status={service.buildStatus} />
                </div>
                <Button
                  variant="outlined"
                  size="small"
                  loading={actionInProgress === 'build'}
                  disabled={!!actionInProgress}
                  onclick={() => void runAction('build', '/services/:id/build')}
                  startIcon={<Icon icon={icons.wrench} size="small" />}
                >
                  Build
                </Button>
              </div>
            ) : null}
            <strong>Run</strong>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontFamily: 'monospace' }}>{service.runCommand}</span>
              <RunStatusChip status={service.runStatus} />
            </div>
            {service.runStatus !== 'running' ? (
              <Button
                variant="outlined"
                size="small"
                color="success"
                loading={actionInProgress === 'start'}
                disabled={!!actionInProgress}
                onclick={() => void runAction('start', '/services/:id/start')}
                startIcon={<Icon icon={icons.play} size="small" />}
              >
                Start
              </Button>
            ) : (
              <Button
                variant="outlined"
                size="small"
                loading={actionInProgress === 'stop'}
                disabled={!!actionInProgress}
                onclick={() => void runAction('stop', '/services/:id/stop')}
                startIcon={<Icon icon={icons.stopCircle} size="small" />}
              >
                Stop
              </Button>
            )}
          </div>
        </Paper>
        <ServiceHistory serviceId={service.id} />
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
}

type HistoryColumn = 'createdAt' | 'event' | 'triggeredBy' | 'triggerSource' | 'metadata' | 'processUid'

const historyEventValues = Object.entries(eventLabels).map(([value, label]) => ({ value, label }))

const historyColumnFilters: { [K in HistoryColumn]?: ColumnFilterConfig } = {
  event: { type: 'enum', values: historyEventValues },
  triggeredBy: { type: 'string' },
  triggerSource: {
    type: 'enum',
    values: [
      { label: 'API', value: 'api' },
      { label: 'MCP', value: 'mcp' },
      { label: 'Auto-fetch', value: 'auto-fetch' },
      { label: 'Auto-restart', value: 'auto-restart' },
      { label: 'System', value: 'system' },
    ],
  },
  createdAt: { type: 'date' },
}

const ServiceHistory = Shade<ServiceHistoryProps>({
  shadowDomName: 'shade-service-history',
  render: (options) => {
    const { props, injector, useDisposable, useObservable } = options

    const collectionService = useDisposable(
      'collectionService',
      () => new CollectionService<ServiceStateHistory>({ searchField: 'event' }),
    )

    const findOptions = useDisposable(
      'findOptions',
      () =>
        new ObservableValue<FindOptions<ServiceStateHistory, Array<keyof ServiceStateHistory>>>({
          top: 25,
          order: { id: 'DESC' },
        }),
    )

    const [currentFindOptions] = useObservable('findOptions', findOptions)

    const historyState = useCollectionSync(options, ServiceStateHistory, {
      filter: { serviceId: { $eq: props.serviceId }, ...currentFindOptions.filter },
      order: currentFindOptions.order ?? { id: 'DESC' },
      top: currentFindOptions.top,
      skip: currentFindOptions.skip,
    })

    const isLoading = historyState.status === 'connecting'
    const entries =
      historyState.status === 'synced' || historyState.status === 'cached' ? historyState.data.entries : []
    const count = historyState.status === 'synced' || historyState.status === 'cached' ? historyState.data.count : 0

    collectionService.data.setValue({ entries, count })

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
          <DataGrid<ServiceStateHistory, HistoryColumn>
            columns={['createdAt', 'event', 'triggeredBy', 'triggerSource', 'metadata', 'processUid']}
            findOptions={findOptions}
            styles={undefined}
            collectionService={collectionService}
            columnFilters={historyColumnFilters}
            headerComponents={{
              createdAt: () => <span>Time</span>,
              event: () => <span>Event</span>,
              triggeredBy: () => <span>Triggered by</span>,
              triggerSource: () => <span>Source</span>,
              metadata: () => <span>Details</span>,
              processUid: () => <span>Logs</span>,
            }}
            rowComponents={{
              createdAt: (entry) => <span>{new Date(entry.createdAt).toLocaleString()}</span>,
              event: (entry) => <span>{eventLabels[entry.event] ?? entry.event}</span>,
              triggeredBy: (entry) => <span>{entry.triggeredBy}</span>,
              triggerSource: (entry) => <span>{entry.triggerSource}</span>,
              metadata: (entry) => (
                <span style={{ fontFamily: 'monospace', fontSize: '12px', opacity: '0.8' }}>
                  {entry.metadata ?? ''}
                </span>
              ),
              processUid: (entry) =>
                entry.processUid ? (
                  <Button
                    size="small"
                    onclick={() => navigate(injector, `/services/${props.serviceId}/logs/${entry.processUid}`)}
                  >
                    Show Logs
                  </Button>
                ) : (
                  <span />
                ),
            }}
          />
        )}
      </Paper>
    )
  },
})
