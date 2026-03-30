import { useCollectionSync, useEntitySync } from '@furystack/entity-sync-client'
import { createComponent, LocationService, Shade } from '@furystack/shades'
import { ConfirmDialog, Loader, PageContainer, PageHeader, Tabs } from '@furystack/shades-common-components'
import type { StackView } from 'common'
import {
  getServiceCwd,
  GitHubRepository,
  mergeServiceView,
  Prerequisite,
  PrerequisiteCheckResult,
  ServiceConfig,
  ServiceDefinition,
  ServiceGitStatus,
  ServiceStatus,
  StackConfig,
  StackDefinition,
} from 'common'

import { stackCraftNavigate } from '../../../components/app-routes.js'
import { getPrerequisiteSummary } from '../../../utils/prerequisite-summary.js'
import { ServiceDetailActionBar } from './action-bar.js'
import { ConfigurationTab } from './configuration-tab.js'
import { ServiceHistory } from './history-tab.js'
import { LogsTab } from './logs-tab.js'
import { OverviewTab } from './overview-tab.js'
import {
  applyServiceFiles,
  createPrerequisite,
  createRepository,
  deleteService,
  runServiceAction,
  saveService,
} from './utils.js'

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

    const gitStatusState = useEntitySync(options, ServiceGitStatus, props.serviceId)

    const statusData = statusState.status === 'synced' ? statusState.data : undefined
    const configData = configState.status === 'synced' ? configState.data : undefined
    const gitStatusData = gitStatusState.status === 'synced' ? gitStatusState.data : undefined
    const service = mergeServiceView(serviceData, configData, statusData, gitStatusData)

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

    const [actionInProgress, setActionInProgress] = useState<string | null>('actionInProgress', null)

    return (
      <PageContainer>
        <PageHeader
          title={service.displayName}
          actions={
            <ServiceDetailActionBar
              service={service}
              servicePrereqs={servicePrereqs}
              prereqSatisfiedCount={prereqSatisfiedCount}
              prereqFailedCount={prereqFailedCount}
              actionInProgress={actionInProgress}
              onRunAction={(apiAction) => void runServiceAction(injector, service.id, apiAction, setActionInProgress)}
              onDelete={() => setIsConfirmingDelete(true)}
            />
          }
        />

        <div data-testid="service-detail-tabs" style={{ display: 'contents' }}>
          <Tabs
            activeKey={activeTab}
            onTabChange={(key) => setActiveTab(key as TabId)}
            tabs={[
              {
                header: <span>Overview</span>,
                hash: 'overview',
                component: (
                  <OverviewTab
                    service={service}
                    linkedRepo={linkedRepo}
                    fullCwd={fullCwd}
                    servicePrereqs={servicePrereqs}
                    prereqSatisfiedCount={prereqSatisfiedCount}
                    prereqFailedCount={prereqFailedCount}
                    actionInProgress={actionInProgress}
                    onAction={(apiAction) =>
                      void runServiceAction(injector, service.id, apiAction, setActionInProgress)
                    }
                    onViewLogs={() =>
                      stackCraftNavigate(injector, '/stacks/:stackName/services/:serviceId/logs', {
                        stackName: service.stackName,
                        serviceId: service.id,
                      })
                    }
                  />
                ),
              },
              {
                header: <span>Logs</span>,
                hash: 'logs',
                component: <LogsTab serviceId={service.id} stackName={service.stackName} />,
              },
              {
                header: <span>History</span>,
                hash: 'history',
                component: <ServiceHistory serviceId={service.id} stackName={service.stackName} />,
              },
              {
                header: <span>Configuration</span>,
                hash: 'configuration',
                component: (
                  <ConfigurationTab
                    service={service}
                    repos={repos}
                    allPrereqs={allPrereqs}
                    otherServices={otherServices}
                    servicePrereqs={servicePrereqs}
                    stackConfig={stackConfig}
                    actionInProgress={actionInProgress}
                    onSave={(data) => {
                      void saveService(injector, service.id, data, service.displayName).then((ok) => {
                        if (ok) setActiveTab('overview')
                      })
                    }}
                    onCancel={() => setActiveTab('overview')}
                    onCreatePrerequisite={(data) => createPrerequisite(injector, service.stackName, data)}
                    onCreateRepository={(data) => createRepository(injector, service.stackName, data)}
                    onApplyFiles={(relativePath) =>
                      applyServiceFiles(injector, service.id, setActionInProgress, relativePath)
                    }
                  />
                ),
              },
            ]}
          />
        </div>

        {ConfirmDialog(isConfirmingDelete, {
          title: 'Delete Service',
          message: `Are you sure you want to delete "${service.displayName}"? This action cannot be undone.`,
          confirmText: 'Delete',
          onConfirm: () => void deleteService(injector, service.id, service.displayName, service.stackName),
          onCancel: () => setIsConfirmingDelete(false),
        })}
      </PageContainer>
    )
  },
})
