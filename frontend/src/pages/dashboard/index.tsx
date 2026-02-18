import { useCollectionSync } from '@furystack/entity-sync-client'
import { createComponent, NestedRouteLink, Shade } from '@furystack/shades'
import { Button, Loader, PageContainer, PageHeader, Paper } from '@furystack/shades-common-components'
import { Service, Stack } from 'common'

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
      </PageContainer>
    )
  },
})
