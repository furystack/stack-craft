import { useCollectionSync, useEntitySync } from '@furystack/entity-sync-client'
import { createComponent, LocationService, Shade } from '@furystack/shades'
import {
  ConfirmDialog,
  cssVariableTheme,
  Loader,
  PageContainer,
  PageHeader,
  Paper,
  Tabs,
  Typography,
} from '@furystack/shades-common-components'
import type { StackView } from 'common'
import {
  getServiceCwd,
  GitHubRepository,
  mergeServiceView,
  Prerequisite,
  ServiceConfig,
  ServiceDefinition,
  ServiceDependencyLink,
  ServiceGitStatus,
  ServicePrerequisiteLink,
  ServiceStatus,
  StackConfig,
  StackDefinition,
} from 'common'

import { PrerequisiteSummaryChip } from '../../../components/prerequisite-summary-chip.js'
import { ServiceStatusIndicator } from '../../../components/service-status-indicator.js'
import { ServiceDetailActionBar } from './action-bar.js'
import { ConfigurationTab } from './configuration-tab.js'
import { FilesTab } from './files-tab.js'
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

export type TabId = 'overview' | 'logs' | 'history' | 'files' | 'configuration'

type ServiceDetailProps = {
  stackName: string
  serviceId: string
}

export const ServiceDetail = Shade<ServiceDetailProps>({
  customElementName: 'shade-service-detail',
  render: (options) => {
    const { props, injector, useState } = options
    const locationService = injector.getInstance(LocationService)
    const validTabs: TabId[] = ['overview', 'logs', 'history', 'files', 'configuration']
    const hashValue = locationService.onLocationHashChanged.getValue().replace('#', '')
    const searchState = locationService.onDeserializedLocationSearchChanged.getValue()
    const initialTab: TabId = validTabs.includes(hashValue as TabId)
      ? (hashValue as TabId)
      : searchState.edit === true
        ? 'configuration'
        : 'overview'
    const [activeTab, setActiveTabState] = useState<TabId>('activeTab', initialTab)
    const [isConfirmingDelete, setIsConfirmingDelete] = useState('isConfirmingDelete', false)

    const setActiveTab = (tab: TabId) => {
      locationService.replace(`${window.location.pathname}#${tab}`)
      setActiveTabState(tab)
    }

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

    const prereqLinksState = useCollectionSync(options, ServicePrerequisiteLink, {
      filter: { serviceId: { $eq: props.serviceId } },
    })
    const depLinksState = useCollectionSync(options, ServiceDependencyLink, {
      filter: { serviceId: { $eq: props.serviceId } },
    })
    const prereqLinkEntries =
      prereqLinksState.status === 'synced' || prereqLinksState.status === 'cached' ? prereqLinksState.data.entries : []
    const depLinkEntries =
      depLinksState.status === 'synced' || depLinksState.status === 'cached' ? depLinksState.data.entries : []
    const relations = {
      prerequisiteIds: prereqLinkEntries.map((l) => l.prerequisiteId),
      prerequisiteServiceIds: depLinkEntries.map((l) => l.dependsOnServiceId),
    }

    const service = mergeServiceView(serviceData, configData, statusData, gitStatusData, relations)

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
        <Paper
          elevation={2}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: cssVariableTheme.spacing.md,
            position: 'sticky',
            top: '0',
            zIndex: '1',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: cssVariableTheme.spacing.sm, flexWrap: 'wrap' }}>
            <Typography
              variant="h4"
              style={{
                margin: '0',
                lineHeight: '100%',
                marginRight: cssVariableTheme.spacing.lg,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {service.displayName}
            </Typography>
            <ServiceStatusIndicator service={service} />
            {service.prerequisiteIds.length > 0 ? (
              <PrerequisiteSummaryChip prerequisiteIds={service.prerequisiteIds} />
            ) : null}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: cssVariableTheme.spacing.sm, flexShrink: '0' }}>
            <ServiceDetailActionBar
              service={service}
              actionInProgress={actionInProgress}
              isEditing={activeTab === 'configuration'}
              onRunAction={(apiAction) => void runServiceAction(injector, service.id, apiAction, setActionInProgress)}
              onEdit={() => setActiveTab('configuration')}
              onDelete={() => setIsConfirmingDelete(true)}
            />
          </div>
        </Paper>

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
                    actionInProgress={actionInProgress}
                    onAction={(apiAction) =>
                      void runServiceAction(injector, service.id, apiAction, setActionInProgress)
                    }
                    onViewLogs={() => setActiveTab('logs')}
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
                header: <span>Files</span>,
                hash: 'files',
                component: (
                  <FilesTab
                    service={service}
                    actionInProgress={actionInProgress}
                    onSaveFiles={async (files, localFiles) => {
                      await saveService(injector, service.id, { files, localFiles }, service.displayName)
                    }}
                    onApplyFiles={(relativePath) =>
                      applyServiceFiles(injector, service.id, setActionInProgress, relativePath)
                    }
                  />
                ),
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
                    onSave={(data) => {
                      void saveService(injector, service.id, data, service.displayName).then((ok) => {
                        if (ok) setActiveTab('overview')
                      })
                    }}
                    onCancel={() => setActiveTab('overview')}
                    onCreatePrerequisite={(data) => createPrerequisite(injector, service.stackName, data)}
                    onCreateRepository={(data) => createRepository(injector, service.stackName, data)}
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
