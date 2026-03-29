import type { FindOptions } from '@furystack/core'
import { useCollectionSync, useEntitySync } from '@furystack/entity-sync-client'
import { createComponent, LocationService, Shade } from '@furystack/shades'
import type { ColumnFilterConfig } from '@furystack/shades-common-components'
import {
  Button,
  Chip,
  CollectionService,
  ConfirmDialog,
  cssVariableTheme,
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
import type { PrerequisiteCheckStatus, ServiceView, StackView } from 'common'
import {
  getServiceCwd,
  GitHubRepository,
  Prerequisite,
  PrerequisiteCheckResult,
  ServiceConfig,
  ServiceDefinition,
  ServiceStateHistory,
  ServiceStatus,
  StackConfig,
  StackDefinition,
} from 'common'
import { StackCraftNestedRouteLink, stackCraftNavigate } from '../../components/app-routes.js'
import { ServiceForm } from '../../components/entity-forms/service-form.js'
import { LogViewer } from '../../components/log-viewer.js'
import { PrerequisiteList } from '../../components/prerequisite-list.js'
import { ServiceEnvOverrides } from '../../components/service-env-overrides.js'
import { BranchSelector } from '../../components/branch-selector.js'
import { ServicePipelineStepper } from '../../components/service-pipeline-stepper.js'
import { ServiceStatusIndicator } from '../../components/service-status-indicator.js'
import { GitHubReposApiClient } from '../../services/api-clients/github-repos-api-client.js'
import { PrerequisitesApiClient } from '../../services/api-clients/prerequisites-api-client.js'
import { ServicesApiClient } from '../../services/api-clients/services-api-client.js'
import { getPrimaryAction, getSecondaryActions } from '../../utils/service-pipeline.js'

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

type TabId = 'overview' | 'logs' | 'history' | 'configuration'

type ServiceDetailProps = {
  stackName: string
  serviceId: string
}

export const ServiceDetail = Shade<ServiceDetailProps>({
  customElementName: 'shade-service-detail',
  render: (options) => {
    const { props, injector, useState } = options
    const locationService = injector.getInstance(LocationService)
    const searchState = locationService.onDeserializedLocationSearchChanged.getValue()
    const hasEditParam = searchState.edit === true
    const initialTab: TabId = hasEditParam ? 'configuration' : 'overview'
    const [activeTab, setActiveTab] = useState<TabId>('activeTab', initialTab)
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
          <PageHeader title="Error loading service" description={serviceState.error} />
        </PageContainer>
      )
    }

    const serviceData = serviceState.data
    if (!serviceData) {
      return (
        <PageContainer>
          <PageHeader title="Service not found" />
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
      environmentVariableOverrides: {},
      localFiles: [],
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

    const prereqsState = useCollectionSync(options, Prerequisite, {
      filter: { stackName: { $eq: service.stackName } },
    })
    const allPrereqs =
      prereqsState.status === 'synced' || prereqsState.status === 'cached' ? prereqsState.data.entries : []
    const servicePrereqs = allPrereqs.filter((p) => service.prerequisiteIds.includes(p.id))

    const checkResultsState = useCollectionSync(options, PrerequisiteCheckResult, {})
    const checkResults =
      checkResultsState.status === 'synced' || checkResultsState.status === 'cached'
        ? checkResultsState.data.entries
        : []
    const checkResultMap = new Map(checkResults.map((r) => [r.prerequisiteId, r]))

    const getPrereqStatus = (id: string): PrerequisiteCheckStatus => checkResultMap.get(id)?.status ?? 'unchecked'

    const prereqSatisfiedCount = servicePrereqs.filter((p) => getPrereqStatus(p.id) === 'satisfied').length
    const prereqFailedCount = servicePrereqs.filter((p) => getPrereqStatus(p.id) === 'failed').length

    const otherServicesState = useCollectionSync(options, ServiceDefinition, {
      filter: { stackName: { $eq: service.stackName } },
    })
    const otherServices = (
      otherServicesState.status === 'synced' || otherServicesState.status === 'cached'
        ? otherServicesState.data.entries
        : []
    ).filter((s) => s.id !== service.id)

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
    const prereqsApi = injector.getInstance(PrerequisitesApiClient)
    const reposApi = injector.getInstance(GitHubReposApiClient)
    const noty = injector.getInstance(NotyService)
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
            prerequisiteIds: data.prerequisiteIds,
            prerequisiteServiceIds: data.prerequisiteServiceIds,
            files: data.files,
            localFiles: data.localFiles,
          },
        })
        noty.emit('onNotyAdded', {
          title: 'Service updated',
          body: `"${data.displayName ?? service.displayName}" was updated successfully.`,
          type: 'success',
        })
        setActiveTab('overview')
      } catch (error) {
        noty.emit('onNotyAdded', {
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
        noty.emit('onNotyAdded', {
          title: 'Service deleted',
          body: `"${service.displayName}" was deleted.`,
          type: 'success',
        })
        stackCraftNavigate(injector, '/stacks/:stackName/services', { stackName: service.stackName })
      } catch (error) {
        noty.emit('onNotyAdded', {
          title: 'Error',
          body: error instanceof Error ? error.message : 'Failed to delete service',
          type: 'error',
        })
      }
    }

    const handleCreatePrerequisite = async (data: Partial<Prerequisite>): Promise<string> => {
      const newId = crypto.randomUUID()
      await prereqsApi.call({
        method: 'POST',
        action: '/prerequisites',
        body: {
          id: newId,
          stackName: service.stackName,
          name: data.name!,
          type: data.type!,
          config: data.config!,
          installationHelp: data.installationHelp ?? '',
        },
      })
      noty.emit('onNotyAdded', { title: 'Prerequisite added', body: `"${data.name}" was added.`, type: 'success' })
      return newId
    }

    const handleCreateRepository = async (data: Partial<GitHubRepository>): Promise<string> => {
      const newId = crypto.randomUUID()
      await reposApi.call({
        method: 'POST',
        action: '/github-repositories',
        body: {
          id: newId,
          stackName: service.stackName,
          url: data.url!,
          displayName: data.displayName!,
          description: data.description ?? '',
        },
      })
      noty.emit('onNotyAdded', {
        title: 'Repository added',
        body: `"${data.displayName}" was added.`,
        type: 'success',
      })
      return newId
    }

    const primary = getPrimaryAction(service)
    const secondaryActions = getSecondaryActions(service)

    const tabs: Array<{ id: TabId; label: string }> = [
      { id: 'overview', label: 'Overview' },
      { id: 'logs', label: 'Logs' },
      { id: 'history', label: 'History' },
      { id: 'configuration', label: 'Configuration' },
    ]

    return (
      <PageContainer>
        {/* Header */}
        <PageHeader
          title={service.displayName}
          actions={
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              <ServiceStatusIndicator service={service} />
              {service.repositoryId ? (
                <BranchSelector
                  serviceId={service.id}
                  currentBranch={service.currentBranch}
                  isCloned={service.cloneStatus === 'cloned'}
                />
              ) : null}
              {servicePrereqs.length > 0 ? (
                <Chip
                  variant="outlined"
                  size="small"
                  color={
                    prereqFailedCount > 0
                      ? 'error'
                      : prereqSatisfiedCount === servicePrereqs.length
                        ? 'success'
                        : 'secondary'
                  }
                >
                  {prereqSatisfiedCount === servicePrereqs.length
                    ? '✓ Prerequisites OK'
                    : `${prereqSatisfiedCount}/${servicePrereqs.length} prereqs`}
                </Chip>
              ) : null}
              {primary.apiAction ? (
                <Button
                  variant="contained"
                  size="small"
                  color={primary.color === 'secondary' ? undefined : primary.color}
                  loading={!!actionInProgress}
                  disabled={!!actionInProgress}
                  onclick={() => void runAction(primary.label, primary.apiAction)}
                >
                  {primary.label}
                </Button>
              ) : null}
              {secondaryActions.map((action) => (
                <Button
                  variant="outlined"
                  size="small"
                  color={action.color === 'secondary' ? undefined : action.color}
                  title={action.tooltip}
                  loading={actionInProgress === action.label}
                  disabled={!!actionInProgress}
                  onclick={() => void runAction(action.label, action.apiAction)}
                >
                  {action.label}
                </Button>
              ))}
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

        {/* Tab bar */}
        <ServiceTabBar tabs={tabs} activeTab={activeTab} onTabChange={setActiveTab} />

        {/* Tab content */}
        {activeTab === 'overview' ? (
          <OverviewTab
            service={service}
            linkedRepo={linkedRepo}
            fullCwd={fullCwd}
            servicePrereqs={servicePrereqs}
            prereqSatisfiedCount={prereqSatisfiedCount}
            prereqFailedCount={prereqFailedCount}
            actionInProgress={actionInProgress}
            onAction={(apiAction) => void runAction(apiAction, apiAction)}
            onViewLogs={() =>
              stackCraftNavigate(injector, '/stacks/:stackName/services/:serviceId/logs', {
                stackName: service.stackName,
                serviceId: service.id,
              })
            }
          />
        ) : null}

        {activeTab === 'logs' ? <LogsTab serviceId={service.id} stackName={service.stackName} /> : null}

        {activeTab === 'history' ? <ServiceHistory serviceId={service.id} stackName={service.stackName} /> : null}

        {activeTab === 'configuration' ? (
          <ConfigurationTab
            service={service}
            repos={repos}
            allPrereqs={allPrereqs}
            otherServices={otherServices}
            servicePrereqs={servicePrereqs}
            stackConfig={stackConfig}
            actionInProgress={actionInProgress}
            onSave={(data) => void handleSave(data)}
            onCancel={() => setActiveTab('overview')}
            onCreatePrerequisite={handleCreatePrerequisite}
            onCreateRepository={handleCreateRepository}
            onApplyFiles={async (relativePath?: string) => {
              const key = relativePath ? `apply-file-${relativePath}` : 'apply-files-all'
              setActionInProgress(key)
              try {
                await api.call({
                  method: 'POST',
                  action: '/services/:id/apply-files',
                  url: { id: service.id },
                  body: relativePath ? { relativePath } : {},
                })
                noty.emit('onNotyAdded', {
                  title: 'Files applied',
                  body: relativePath
                    ? `${relativePath} was written to disk.`
                    : 'All shared files were written to disk.',
                  type: 'success',
                })
              } catch (error) {
                noty.emit('onNotyAdded', {
                  title: 'Error',
                  body: error instanceof Error ? error.message : 'Failed to apply files',
                  type: 'error',
                })
              } finally {
                setActionInProgress(null)
              }
            }}
          />
        ) : null}

        {ConfirmDialog(isConfirmingDelete, {
          title: 'Delete Service',
          message: `Are you sure you want to delete "${service.displayName}"? This action cannot be undone.`,
          confirmText: 'Delete',
          onConfirm: () => void handleDelete(),
          onCancel: () => setIsConfirmingDelete(false),
        })}
      </PageContainer>
    )
  },
})

/* ============================================
 * Tab Bar
 * ============================================ */

type ServiceTabBarProps = {
  tabs: Array<{ id: TabId; label: string }>
  activeTab: TabId
  onTabChange: (tab: TabId) => void
}

const ServiceTabBar = Shade<ServiceTabBarProps>({
  customElementName: 'shade-service-tab-bar',
  css: {
    display: 'flex',
    gap: '0',
    borderBottom: `1px solid ${cssVariableTheme.divider}`,
    marginBottom: cssVariableTheme.spacing.md,

    '& button': {
      padding: `${cssVariableTheme.spacing.sm} ${cssVariableTheme.spacing.lg}`,
      cursor: 'pointer',
      border: 'none',
      borderBottom: '2px solid transparent',
      background: 'transparent',
      color: cssVariableTheme.text.secondary,
      fontWeight: cssVariableTheme.typography.fontWeight.normal,
      fontSize: cssVariableTheme.typography.fontSize.md,
      transition: `all ${cssVariableTheme.transitions.duration.normal} ${cssVariableTheme.transitions.easing.easeInOut}`,
      fontFamily: 'inherit',
    },
    '& button:hover': {
      color: cssVariableTheme.text.primary,
    },
    '& button[data-active]': {
      borderBottomColor: cssVariableTheme.palette.primary.main,
      color: cssVariableTheme.palette.primary.main,
      fontWeight: cssVariableTheme.typography.fontWeight.semibold,
    },
  },
  render: ({ props }) => {
    return (
      <div data-testid="service-detail-tabs" role="tablist">
        {props.tabs.map((tab) => (
          <button
            type="button"
            role="tab"
            aria-selected={props.activeTab === tab.id}
            onclick={() => props.onTabChange(tab.id)}
            {...(props.activeTab === tab.id ? { 'data-active': '' } : {})}
          >
            {tab.label}
          </button>
        ))}
      </div>
    )
  },
})

/* ============================================
 * Overview Tab
 * ============================================ */

type OverviewTabProps = {
  service: ServiceView
  linkedRepo: GitHubRepository | undefined
  fullCwd: string | null
  servicePrereqs: Prerequisite[]
  prereqSatisfiedCount: number
  prereqFailedCount: number
  actionInProgress: string | null
  onAction: (apiAction: string) => void
  onViewLogs: (stageId: string) => void
}

const OverviewTab = Shade<OverviewTabProps>({
  customElementName: 'shade-service-overview-tab',
  render: ({ props }) => {
    const { service, linkedRepo, fullCwd, servicePrereqs, prereqSatisfiedCount, prereqFailedCount } = props

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {service.description ? (
          <Paper>
            <MarkdownDisplay content={service.description} />
          </Paper>
        ) : null}

        {/* Pipeline stepper */}
        <Paper>
          <h3 style={{ margin: '0 0 8px 0' }}>Pipeline</h3>
          <ServicePipelineStepper service={service} onAction={props.onAction} onViewLogs={props.onViewLogs} />
        </Paper>

        {/* Service info */}
        <Paper>
          <h3 style={{ margin: '0 0 12px 0' }}>Service Info</h3>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'minmax(120px, auto) 1fr auto',
              gap: `8px ${cssVariableTheme.spacing.md}`,
              fontSize: cssVariableTheme.typography.fontSize.md,
              alignItems: 'center',
            }}
          >
            {linkedRepo ? (
              <div style={{ display: 'contents' }}>
                <strong>Repository</strong>
                <span>
                  <StackCraftNestedRouteLink
                    href="/stacks/:stackName/repositories/:repositoryId"
                    params={{ stackName: service.stackName, repositoryId: linkedRepo.id }}
                    style={{ color: 'inherit' }}
                  >
                    {linkedRepo.displayName}
                  </StackCraftNestedRouteLink>
                </span>
                <span>
                  {linkedRepo.url ? (
                    <a href={linkedRepo.url} target="_blank" rel="noopener noreferrer" style={{ color: 'inherit' }}>
                      <Button
                        variant="outlined"
                        size="small"
                        startIcon={<Icon icon={icons.externalLink} size="small" />}
                      >
                        Open
                      </Button>
                    </a>
                  ) : null}
                </span>
              </div>
            ) : null}
            {service.repositoryId ? (
              <div style={{ display: 'contents' }}>
                <strong>Branch</strong>
                <span>
                  <BranchSelector
                    serviceId={service.id}
                    currentBranch={service.currentBranch}
                    isCloned={service.cloneStatus === 'cloned'}
                  />
                </span>
                <span />
              </div>
            ) : null}
            <strong>Working Directory</strong>
            <span style={{ fontFamily: 'monospace', fontSize: cssVariableTheme.typography.fontSize.sm }}>
              {fullCwd ?? '(loading…)'}
            </span>
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
          </div>
        </Paper>

        {/* Prerequisites */}
        {servicePrereqs.length > 0 ? (
          <Paper>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
              <h3 style={{ margin: '0' }}>Prerequisites</h3>
              {prereqSatisfiedCount === servicePrereqs.length ? (
                <Chip variant="outlined" color="success" size="small">
                  ✓ All satisfied
                </Chip>
              ) : prereqFailedCount > 0 ? (
                <Chip variant="outlined" color="error" size="small">
                  {prereqSatisfiedCount}/{servicePrereqs.length} satisfied
                </Chip>
              ) : (
                <Chip variant="outlined" color="secondary" size="small">
                  {prereqSatisfiedCount}/{servicePrereqs.length} satisfied
                </Chip>
              )}
            </div>
            <PrerequisiteList prerequisites={servicePrereqs} />
          </Paper>
        ) : null}
      </div>
    )
  },
})

/* ============================================
 * Logs Tab
 * ============================================ */

type LogsTabProps = {
  serviceId: string
  stackName: string
}

const LogsTab = Shade<LogsTabProps>({
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

/* ============================================
 * History Tab
 * ============================================ */

type ServiceHistoryProps = {
  serviceId: string
  stackName: string
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
  customElementName: 'shade-service-history',
  render: (options) => {
    const { props, injector, useDisposable, useState } = options

    const collectionService = useDisposable(
      'collectionService',
      () => new CollectionService<ServiceStateHistory>({ searchField: 'event' }),
    )

    const [findOptions, setFindOptions] = useState<FindOptions<ServiceStateHistory, Array<keyof ServiceStateHistory>>>(
      'findOptionsObservable',
      {
        top: 25,
        order: { id: 'DESC' },
      },
    )

    const historyState = useCollectionSync(options, ServiceStateHistory, {
      filter: { serviceId: { $eq: props.serviceId }, ...findOptions.filter },
      order: findOptions.order ?? { id: 'DESC' },
      top: findOptions.top,
      skip: findOptions.skip,
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
            onFindOptionsChange={setFindOptions}
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
                <span
                  style={{ fontFamily: 'monospace', fontSize: cssVariableTheme.typography.fontSize.sm, opacity: '0.8' }}
                >
                  {entry.metadata ?? ''}
                </span>
              ),
              processUid: (entry) => {
                const { processUid } = entry
                if (!processUid) return <span />
                return (
                  <Button
                    size="small"
                    onclick={() =>
                      stackCraftNavigate(injector, '/stacks/:stackName/services/:serviceId/logs/:processUid', {
                        stackName: props.stackName,
                        serviceId: props.serviceId,
                        processUid,
                      })
                    }
                  >
                    Show Logs
                  </Button>
                )
              },
            }}
          />
        )}
      </Paper>
    )
  },
})

/* ============================================
 * Configuration Tab
 * ============================================ */

type ConfigurationTabProps = {
  service: ServiceView
  repos: GitHubRepository[]
  allPrereqs: Prerequisite[]
  otherServices: ServiceDefinition[]
  servicePrereqs: Prerequisite[]
  stackConfig: StackConfig | undefined
  actionInProgress: string | null
  onSave: (data: Partial<ServiceView>) => void
  onCancel: () => void
  onCreatePrerequisite: (data: Partial<Prerequisite>) => Promise<string>
  onCreateRepository: (data: Partial<GitHubRepository>) => Promise<string>
  onApplyFiles: (relativePath?: string) => Promise<void>
}

const ConfigurationTab = Shade<ConfigurationTabProps>({
  customElementName: 'shade-service-config-tab',
  render: ({ props }) => {
    const { service, repos, allPrereqs, otherServices, servicePrereqs, stackConfig, actionInProgress } = props

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {/* Edit form */}
        <Paper>
          <h3 style={{ margin: '0 0 12px 0' }}>Edit Service</h3>
          <ServiceForm
            mode="edit"
            stackName={service.stackName}
            repositories={repos}
            prerequisites={allPrereqs}
            otherServices={otherServices}
            initial={service}
            onSubmit={props.onSave}
            onCreatePrerequisite={props.onCreatePrerequisite}
            onCreateRepository={props.onCreateRepository}
            onCancel={props.onCancel}
          />
        </Paper>

        {/* Shared files */}
        {service.files && service.files.length > 0 ? (
          <Paper>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
              <h3 style={{ margin: '0' }}>Shared Files</h3>
              <Chip variant="outlined" size="small">
                {service.files.length} file(s)
              </Chip>
              <Button
                variant="outlined"
                size="small"
                loading={actionInProgress === 'apply-files-all'}
                disabled={!!actionInProgress}
                onclick={() => void props.onApplyFiles()}
                startIcon={<Icon icon={icons.download} size="small" />}
              >
                Apply All
              </Button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {service.files.map((file) => {
                const isOverridden = (service.localFiles ?? []).some((lf) => lf.relativePath === file.relativePath)
                return (
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '12px',
                      padding: '8px 12px',
                      borderRadius: '8px',
                      border: `1px solid ${cssVariableTheme.divider}`,
                      fontFamily: 'monospace',
                      fontSize: cssVariableTheme.typography.fontSize.sm,
                      opacity: isOverridden ? '0.5' : '1',
                    }}
                  >
                    <span style={{ flex: '1', overflow: 'hidden', textOverflow: 'ellipsis' }}>{file.relativePath}</span>
                    {isOverridden ? (
                      <Chip variant="outlined" size="small">
                        Overridden by local
                      </Chip>
                    ) : null}
                    <Button
                      variant="outlined"
                      size="small"
                      loading={actionInProgress === `apply-file-${file.relativePath}`}
                      disabled={!!actionInProgress}
                      onclick={() => void props.onApplyFiles(file.relativePath)}
                      startIcon={<Icon icon={icons.download} size="small" />}
                    >
                      Apply
                    </Button>
                  </div>
                )
              })}
            </div>
          </Paper>
        ) : null}

        {/* Local files */}
        {service.localFiles && service.localFiles.length > 0 ? (
          <Paper>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
              <h3 style={{ margin: '0' }}>Local Files</h3>
              <Icon icon={icons.lock} size="small" title="Encrypted at rest, never exported" />
              <Chip variant="outlined" size="small">
                {service.localFiles.length} file(s)
              </Chip>
            </div>
            <p style={{ margin: '0 0 8px 0', opacity: '0.6', fontSize: cssVariableTheme.typography.fontSize.sm }}>
              Per-installation secret files. Encrypted at rest and never included in stack exports.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {service.localFiles.map((file) => (
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    padding: '8px 12px',
                    borderRadius: '8px',
                    border: `1px solid ${cssVariableTheme.palette.warning.main}`,
                    fontFamily: 'monospace',
                    fontSize: cssVariableTheme.typography.fontSize.sm,
                  }}
                >
                  <Icon icon={icons.lock} size="small" />
                  <span style={{ flex: '1', overflow: 'hidden', textOverflow: 'ellipsis' }}>{file.relativePath}</span>
                  <Button
                    variant="outlined"
                    size="small"
                    loading={actionInProgress === `apply-file-${file.relativePath}`}
                    disabled={!!actionInProgress}
                    onclick={() => void props.onApplyFiles(file.relativePath)}
                    startIcon={<Icon icon={icons.download} size="small" />}
                  >
                    Apply
                  </Button>
                </div>
              ))}
            </div>
          </Paper>
        ) : null}

        {/* Environment variable overrides */}
        {servicePrereqs.some((p) => p.type === 'env-variable') ? (
          <ServiceEnvOverrides
            service={service}
            envPrereqs={servicePrereqs.filter((p) => p.type === 'env-variable')}
            stackEnvVars={stackConfig?.environmentVariables ?? {}}
          />
        ) : null}
      </div>
    )
  },
})
