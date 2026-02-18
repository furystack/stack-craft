import { useCollectionSync } from '@furystack/entity-sync-client'
import { createComponent, NestedRouteLink, Shade } from '@furystack/shades'
import { Button, Icon, icons, Loader, PageContainer, PageHeader, Paper } from '@furystack/shades-common-components'
import { GitHubRepository, Service, Stack } from 'common'

import { RepositoryTable } from '../../components/repository-table.js'
import { ServiceTable } from '../../components/service-table.js'
import { StackSelector } from '../../components/stack-selector.js'

export const Dashboard = Shade({
  shadowDomName: 'shade-dashboard',
  render: (options) => {
    const [selectedStackName, setSelectedStackName] = options.useState<string | null>('selectedStack', null)

    const stacksState = useCollectionSync(options, Stack, {})
    const stacks = stacksState.status === 'synced' || stacksState.status === 'cached' ? stacksState.data : []

    const activeStackName = selectedStackName ?? stacks[0]?.name ?? null
    if (activeStackName && activeStackName !== selectedStackName && stacks.length > 0) {
      queueMicrotask(() => setSelectedStackName(activeStackName))
    }

    const servicesState = useCollectionSync(options, Service, {
      filter: activeStackName ? { stackName: { $eq: activeStackName } } : undefined,
    })
    const services = servicesState.status === 'synced' || servicesState.status === 'cached' ? servicesState.data : []

    const reposState = useCollectionSync(options, GitHubRepository, {
      filter: activeStackName ? { stackName: { $eq: activeStackName } } : undefined,
    })
    const repos = reposState.status === 'synced' || reposState.status === 'cached' ? reposState.data : []

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

    if (stacks.length === 0) {
      return (
        <PageContainer>
          <PageHeader
            icon="🏠"
            title="Dashboard"
            description="No stacks yet. Create a stack to start managing your services."
            actions={
              <div style={{ display: 'flex', gap: '8px' }}>
                <Button variant="contained" onclick={() => history.pushState(null, '', '/stacks/create')}>
                  Create Stack
                </Button>
                <NestedRouteLink href="/stacks/import">
                  <Button variant="outlined">Import Stack</Button>
                </NestedRouteLink>
              </div>
            }
          />
        </PageContainer>
      )
    }

    const currentStack = stacks.find((s) => s.name === activeStackName)

    return (
      <PageContainer>
        <PageHeader
          icon="🏠"
          title={currentStack?.displayName ?? 'Dashboard'}
          actions={
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <StackSelector
                stacks={stacks}
                selectedStack={activeStackName}
                onSelect={(name) => setSelectedStackName(name)}
              />
              {activeStackName ? (
                <Button
                  variant="outlined"
                  onclick={() => history.pushState(null, '', `/stacks/${activeStackName}/edit`)}
                  startIcon={<Icon icon={icons.edit} size="small" />}
                >
                  Edit Stack
                </Button>
              ) : null}
              {activeStackName ? (
                <Button
                  variant="contained"
                  onclick={() => history.pushState(null, '', `/services/create/${activeStackName}`)}
                >
                  Create Service
                </Button>
              ) : null}
            </div>
          }
        />
        <Paper>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '12px',
            }}
          >
            <h3 style={{ margin: '0', fontSize: '16px' }}>Services</h3>
          </div>
          {services.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '32px' }}>
              <p style={{ opacity: '0.5', marginBottom: '16px' }}>No services in this stack yet.</p>
              {activeStackName ? (
                <Button
                  variant="contained"
                  onclick={() => history.pushState(null, '', `/services/create/${activeStackName}`)}
                >
                  Create Service
                </Button>
              ) : null}
            </div>
          ) : (
            <ServiceTable
              services={services}
              onViewLogs={(serviceId) => history.pushState(null, '', `/services/${serviceId}/logs`)}
              onEdit={(serviceId) => history.pushState(null, '', `/services/${serviceId}`)}
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
            {activeStackName ? (
              <Button
                variant="outlined"
                onclick={() => history.pushState(null, '', `/repositories/create/${activeStackName}`)}
              >
                Add Repository
              </Button>
            ) : null}
          </div>
          {repos.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '32px' }}>
              <p style={{ opacity: '0.5', marginBottom: '16px' }}>No repositories in this stack yet.</p>
              {activeStackName ? (
                <Button
                  variant="outlined"
                  onclick={() => history.pushState(null, '', `/repositories/create/${activeStackName}`)}
                >
                  Add Repository
                </Button>
              ) : null}
            </div>
          ) : (
            <RepositoryTable
              repositories={repos}
              onEdit={(repoId: string) => history.pushState(null, '', `/repositories/${repoId}`)}
            />
          )}
        </Paper>
      </PageContainer>
    )
  },
})
