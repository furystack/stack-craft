import { useCollectionSync, useEntitySync } from '@furystack/entity-sync-client'
import { createComponent, LocationService, Shade } from '@furystack/shades'
import {
  Button,
  Chip,
  ConfirmDialog,
  Icon,
  icons,
  Loader,
  NotyService,
  PageContainer,
  PageHeader,
} from '@furystack/shades-common-components'
import type { ServiceView, StackView } from 'common'
import {
  getServiceCwd,
  GitHubRepository,
  mergeServiceView,
  Prerequisite,
  PrerequisiteCheckResult,
  ServiceConfig,
  ServiceDefinition,
  ServiceStatus,
  StackConfig,
  StackDefinition,
} from 'common'

import { stackCraftNavigate } from '../../../components/app-routes.js'
import { BranchSelector } from '../../../components/branch-selector.js'
import { ServiceStatusIndicator } from '../../../components/service-status-indicator.js'
import { GitHubReposApiClient } from '../../../services/api-clients/github-repos-api-client.js'
import { PrerequisitesApiClient } from '../../../services/api-clients/prerequisites-api-client.js'
import { ServicesApiClient } from '../../../services/api-clients/services-api-client.js'
import { getPrerequisiteSummary } from '../../../utils/prerequisite-summary.js'
import { getPrimaryAction, getSecondaryActions } from '../../../utils/service-pipeline.js'
import { ConfigurationTab } from './configuration-tab.js'
import { ServiceHistory } from './history-tab.js'
import { LogsTab } from './logs-tab.js'
import { OverviewTab } from './overview-tab.js'
import { ServiceTabBar } from './service-tab-bar.js'

export type TabId = 'overview' | 'logs' | 'history' | 'configuration'

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

    const service = mergeServiceView(serviceData, configData, statusData)

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

    const prereqSummary = getPrerequisiteSummary(
      servicePrereqs.map((p) => p.id),
      checkResultMap,
    )
    const prereqSatisfiedCount = prereqSummary?.satisfiedCount ?? 0
    const prereqFailedCount = prereqSummary?.failedCount ?? 0

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

    const runAction = async (apiAction: string) => {
      setActionInProgress(apiAction)
      try {
        await api.call({
          method: 'POST',
          action: apiAction as '/services/:id/start',
          url: { id: service.id },
        })
      } catch (error) {
        const label = apiAction.split('/').pop() ?? apiAction
        noty.emit('onNotyAdded', {
          title: `${label} failed`,
          body: error instanceof Error ? error.message : `Failed to execute ${label}`,
          type: 'error',
        })
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
                  onclick={() => void runAction(primary.apiAction)}
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
                  loading={actionInProgress === action.apiAction}
                  disabled={!!actionInProgress}
                  onclick={() => void runAction(action.apiAction)}
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
        <div role="tabpanel" id={`panel-${activeTab}`} aria-labelledby={`tab-${activeTab}`}>
          {activeTab === 'overview' ? (
            <OverviewTab
              service={service}
              linkedRepo={linkedRepo}
              fullCwd={fullCwd}
              servicePrereqs={servicePrereqs}
              prereqSatisfiedCount={prereqSatisfiedCount}
              prereqFailedCount={prereqFailedCount}
              actionInProgress={actionInProgress}
              onAction={(apiAction) => void runAction(apiAction)}
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
        </div>

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
