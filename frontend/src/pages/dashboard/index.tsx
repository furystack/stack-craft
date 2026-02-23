import { useCollectionSync } from '@furystack/entity-sync-client'
import { createComponent, NestedRouteLink, Shade } from '@furystack/shades'

import {
  Button,
  ButtonGroup,
  Icon,
  icons,
  Loader,
  MarkdownDisplay,
  PageContainer,
  PageHeader,
  Paper,
} from '@furystack/shades-common-components'
import { ServiceConfig, ServiceDefinition, ServiceStatus, StackDefinition } from 'common'
import type { ServiceView } from 'common'
import { navigate } from '../../utils/navigate.js'
import { ServicesApiClient } from '../../services/api-clients/services-api-client.js'

import { RepositoryTable } from '../../components/repository-table.js'
import { ServiceTable } from '../../components/service-table.js'

type DashboardProps = {
  stackName?: string
}

export const Dashboard = Shade<DashboardProps>({
  shadowDomName: 'shade-dashboard',
  render: (options) => {
    const { props, injector } = options

    const stacksState = useCollectionSync(options, StackDefinition, {})
    const stacks = stacksState.status === 'synced' || stacksState.status === 'cached' ? stacksState.data.entries : []

    const isLoading = stacksState.status === 'connecting'

    if (isLoading) {
      return (
        <PageContainer>
          <div style={{ display: 'flex', justifyContent: 'center', padding: '48px' }}>
            <Loader />
          </div>
        </PageContainer>
      )
    }

    // When no stackName is provided (route `/`), redirect to the first stack or show empty state
    if (!props.stackName) {
      if (stacks.length > 0) {
        queueMicrotask(() => navigate(injector, `/stacks/${stacks[0].name}`))
        return null
      }

      return (
        <PageContainer>
          <PageHeader
            icon="🏠"
            title="Dashboard"
            description="No stacks yet. Create a stack to start managing your services."
            actions={
              <div style={{ display: 'flex', gap: '8px' }}>
                <NestedRouteLink href="/stacks/create">
                  <Button variant="contained" size="small" startIcon={<Icon icon={icons.plus} size="small" />}>
                    Create Stack
                  </Button>
                </NestedRouteLink>
                <NestedRouteLink href="/stacks/import">
                  <Button variant="outlined" size="small" startIcon={<Icon icon={icons.upload} size="small" />}>
                    Import Stack
                  </Button>
                </NestedRouteLink>
              </div>
            }
          />
        </PageContainer>
      )
    }

    const currentStack = stacks.find((s) => s.name === props.stackName)

    const servicesState = useCollectionSync(options, ServiceDefinition, {
      filter: { stackName: { $eq: props.stackName } },
    })
    const defs =
      servicesState.status === 'synced' || servicesState.status === 'cached' ? servicesState.data.entries : []

    const statusesState = useCollectionSync(options, ServiceStatus, {})
    const statuses =
      statusesState.status === 'synced' || statusesState.status === 'cached' ? statusesState.data.entries : []

    const configsState = useCollectionSync(options, ServiceConfig, {})
    const configs =
      configsState.status === 'synced' || configsState.status === 'cached' ? configsState.data.entries : []

    const statusMap = new Map(statuses.map((s) => [s.serviceId, s]))
    const configMap = new Map(configs.map((c) => [c.serviceId, c]))

    const services: ServiceView[] = defs.map((def) => ({
      serviceId: def.id,
      autoFetchEnabled: false,
      autoFetchIntervalMinutes: 60,
      autoRestartOnFetch: false,
      cloneStatus: 'not-cloned' as const,
      installStatus: 'not-installed' as const,
      buildStatus: 'not-built' as const,
      runStatus: 'stopped' as const,
      ...def,
      ...(configMap.get(def.id) ?? {}),
      ...(statusMap.get(def.id) ?? {}),
    }))

    const api = injector.getInstance(ServicesApiClient)
    const [selectedServiceIds, setSelectedServiceIds] = options.useState<string[]>('selectedServiceIds', [])
    const [isBulkLoading, setIsBulkLoading] = options.useState('isBulkLoading', false)

    const selectedServices = services.filter((s) => selectedServiceIds.includes(s.id))
    const hasRunning = selectedServices.some((s) => s.runStatus === 'running')
    const hasStopped = selectedServices.some((s) => s.runStatus !== 'running')
    const hasSelection = selectedServices.length > 0

    const bulkAction = async (action: string) => {
      setIsBulkLoading(true)
      for (const svc of selectedServices) {
        try {
          await api.call({
            method: 'POST',
            action: `/services/:id/${action}` as '/services/:id/start',
            url: { id: svc.id },
          })
        } catch {
          // Individual failures are handled by entity-sync status updates
        }
      }
      setIsBulkLoading(false)
    }

    return (
      <PageContainer>
        <PageHeader
          icon={<Icon icon={icons.layers} />}
          title={currentStack?.displayName ?? props.stackName}
          actions={
            <div style={{ display: 'flex', gap: '8px' }}>
              <NestedRouteLink href="/stacks/:stackName/export" params={{ stackName: props.stackName }}>
                <Button variant="outlined" size="small" startIcon={<Icon icon={icons.download} size="small" />}>
                  Export
                </Button>
              </NestedRouteLink>
              <NestedRouteLink href="/stacks/:stackName/edit" params={{ stackName: props.stackName }}>
                <Button variant="outlined" size="small" startIcon={<Icon icon={icons.edit} size="small" />}>
                  Edit Stack
                </Button>
              </NestedRouteLink>
            </div>
          }
        />
        {currentStack?.description ? (
          <Paper>
            <MarkdownDisplay content={currentStack.description} />
          </Paper>
        ) : null}

        <Paper>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              marginBottom: '12px',
              gap: '8px',
            }}
          >
            <h3 style={{ margin: '0', fontSize: '16px' }}>Services ({services.length})</h3>
            {hasSelection ? (
              <span style={{ fontSize: '13px', opacity: '0.7' }}>{selectedServices.length} selected</span>
            ) : null}
            {hasSelection ? (
              <ButtonGroup variant="outlined">
                {hasStopped ? (
                  <Button
                    size="small"
                    color="success"
                    loading={isBulkLoading}
                    onclick={() => void bulkAction('start')}
                    startIcon={<Icon icon={icons.play} size="small" />}
                  >
                    Start
                  </Button>
                ) : null}
                {hasRunning ? (
                  <Button
                    size="small"
                    loading={isBulkLoading}
                    onclick={() => void bulkAction('stop')}
                    startIcon={<Icon icon={icons.stopCircle} size="small" />}
                  >
                    Stop
                  </Button>
                ) : null}
                <Button
                  size="small"
                  loading={isBulkLoading}
                  onclick={() => void bulkAction('pull')}
                  startIcon={<Icon icon={icons.download} size="small" />}
                >
                  Pull
                </Button>
                <Button
                  size="small"
                  loading={isBulkLoading}
                  onclick={() => void bulkAction('install')}
                  startIcon={<Icon icon={icons.packageIcon} size="small" />}
                >
                  Install
                </Button>
                <Button
                  size="small"
                  loading={isBulkLoading}
                  onclick={() => void bulkAction('build')}
                  startIcon={<Icon icon={icons.wrench} size="small" />}
                >
                  Build
                </Button>
                <Button
                  size="small"
                  loading={isBulkLoading}
                  onclick={() => void bulkAction('setup')}
                  startIcon={<Icon icon={icons.settings} size="small" />}
                >
                  Set Up
                </Button>
                <Button
                  size="small"
                  loading={isBulkLoading}
                  onclick={() => void bulkAction('update')}
                  startIcon={<Icon icon={icons.refresh} size="small" />}
                >
                  Update
                </Button>
              </ButtonGroup>
            ) : null}
            <div style={{ flex: '1' }} />
            <NestedRouteLink href="/services/wizard/:stackName" params={{ stackName: props.stackName }}>
              <Button variant="contained" size="small" startIcon={<Icon icon={icons.plus} size="small" />}>
                Create Service
              </Button>
            </NestedRouteLink>
          </div>
          {services.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '32px' }}>
              <p style={{ opacity: '0.5' }}>No services in this stack yet.</p>
            </div>
          ) : (
            <ServiceTable
              services={services}
              onSelectionChange={(selected: ServiceView[]) => {
                const newIds = selected.map((s) => s.id)
                const changed =
                  newIds.length !== selectedServiceIds.length ||
                  newIds.some((id) => !selectedServiceIds.includes(id))
                if (changed) {
                  setSelectedServiceIds(newIds)
                }
              }}
            />
          )}
        </Paper>

        <Paper style={{ marginTop: '16px' }}>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '12px',
            }}
          >
            <h3 style={{ margin: '0', fontSize: '16px' }}>Repositories</h3>
            <NestedRouteLink href="/repositories/create/:stackName" params={{ stackName: props.stackName }}>
              <Button variant="outlined" size="small" startIcon={<Icon icon={icons.plus} size="small" />}>
                Add Repository
              </Button>
            </NestedRouteLink>
          </div>
          <RepositoryTable stackName={props.stackName} />
        </Paper>
      </PageContainer>
    )
  },
})
