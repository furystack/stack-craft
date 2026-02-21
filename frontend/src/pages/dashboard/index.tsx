import { useCollectionSync } from '@furystack/entity-sync-client'
import { createComponent, NestedRouteLink, Shade } from '@furystack/shades'

import { Button, Icon, icons, Loader, PageContainer, PageHeader, Paper } from '@furystack/shades-common-components'
import { GitHubRepository, ServiceDefinition, StackDefinition } from 'common'
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
    const stacks = stacksState.status === 'synced' || stacksState.status === 'cached' ? stacksState.data : []

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
                  <Button variant="contained">Create Stack</Button>
                </NestedRouteLink>
                <NestedRouteLink href="/stacks/import">
                  <Button variant="outlined">Import Stack</Button>
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
    const services: ServiceView[] =
      servicesState.status === 'synced' || servicesState.status === 'cached'
        ? (servicesState.data as ServiceView[])
        : []

    const reposState = useCollectionSync(options, GitHubRepository, {
      filter: { stackName: { $eq: props.stackName } },
    })
    const repos = reposState.status === 'synced' || reposState.status === 'cached' ? reposState.data : []

    const api = injector.getInstance(ServicesApiClient)
    const [selectedServices, setSelectedServices] = options.useState<ServiceView[]>('selectedServices', [])
    const [isBulkLoading, setIsBulkLoading] = options.useState('isBulkLoading', false)

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
          description={currentStack?.description}
          actions={
            <NestedRouteLink href="/stacks/:stackName/edit" params={{ stackName: props.stackName }}>
              <Button variant="outlined" startIcon={<Icon icon={icons.edit} size="small" />}>
                Edit Stack
              </Button>
            </NestedRouteLink>
          }
        />

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
            {hasSelection && hasStopped ? (
              <Button
                variant="outlined"
                size="small"
                color="success"
                disabled={isBulkLoading}
                onclick={() => void bulkAction('start')}
              >
                Start
              </Button>
            ) : null}
            {hasSelection && hasRunning ? (
              <Button variant="outlined" size="small" disabled={isBulkLoading} onclick={() => void bulkAction('stop')}>
                Stop
              </Button>
            ) : null}
            {hasSelection ? (
              <Button variant="outlined" size="small" disabled={isBulkLoading} onclick={() => void bulkAction('pull')}>
                Pull
              </Button>
            ) : null}
            {hasSelection ? (
              <Button
                variant="outlined"
                size="small"
                disabled={isBulkLoading}
                onclick={() => void bulkAction('install')}
              >
                Install
              </Button>
            ) : null}
            {hasSelection ? (
              <Button
                variant="outlined"
                size="small"
                disabled={isBulkLoading}
                onclick={() => void bulkAction('build')}
              >
                Build
              </Button>
            ) : null}
            {hasSelection ? (
              <Button
                variant="outlined"
                size="small"
                disabled={isBulkLoading}
                onclick={() => void bulkAction('setup')}
              >
                Set Up
              </Button>
            ) : null}
            {hasSelection ? (
              <Button
                variant="outlined"
                size="small"
                disabled={isBulkLoading}
                onclick={() => void bulkAction('update')}
              >
                Update
              </Button>
            ) : null}
            <div style={{ flex: '1' }} />
            <NestedRouteLink href="/services/wizard/:stackName" params={{ stackName: props.stackName }}>
              <Button variant="contained" startIcon={<Icon icon={icons.plus} size="small" />}>
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
              onSelectionChange={(selected: ServiceView[]) => setSelectedServices(selected)}
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
            <h3 style={{ margin: '0', fontSize: '16px' }}>Repositories ({repos.length})</h3>
            <NestedRouteLink href="/repositories/create/:stackName" params={{ stackName: props.stackName }}>
              <Button variant="outlined" startIcon={<Icon icon={icons.plus} size="small" />}>
                Add Repository
              </Button>
            </NestedRouteLink>
          </div>
          {repos.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '32px' }}>
              <p style={{ opacity: '0.5' }}>No repositories in this stack yet.</p>
            </div>
          ) : (
            <RepositoryTable repositories={repos} />
          )}
        </Paper>
      </PageContainer>
    )
  },
})
