import { createComponent, NestedRouteLink, Shade } from '@furystack/shades'
import { Button, Icon, icons, NotyService, PageContainer, PageHeader } from '@furystack/shades-common-components'
import { ObservableValue } from '@furystack/utils'
import type { Service, Stack } from 'common'
import { ServiceTable } from '../../components/service-table.js'
import { StackSelector } from '../../components/stack-selector.js'
import { ServicesApiClient } from '../../services/api-clients/services-api-client.js'
import { StacksApiClient } from '../../services/api-clients/stacks-api-client.js'

export const Dashboard = Shade({
  shadowDomName: 'shade-dashboard',
  render: ({ injector, useState, useDisposable }) => {
    const [stacks, setStacks] = useState<Stack[]>('stacks', [])
    const [selectedStackName, setSelectedStackName] = useState<string | null>('selectedStack', null)
    const [services, setServices] = useState<Service[]>('services', [])
    const [isLoading, setIsLoading] = useState('isLoading', true)
    const refreshTrigger = useDisposable('refreshTrigger', () => new ObservableValue(0))

    const stacksApi = injector.getInstance(StacksApiClient)
    const servicesApi = injector.getInstance(ServicesApiClient)

    const loadData = async () => {
      setIsLoading(true)
      try {
        const { result: stackResult } = await stacksApi.call({
          method: 'GET',
          action: '/stacks',
          query: { findOptions: {} },
        })
        setStacks(stackResult.entries)

        const activeStack = selectedStackName ?? stackResult.entries[0]?.name ?? null
        if (activeStack && activeStack !== selectedStackName) {
          setSelectedStackName(activeStack)
        }

        if (activeStack) {
          const { result: serviceResult } = await servicesApi.call({
            method: 'GET',
            action: '/services',
            query: { findOptions: { filter: { stackName: { $eq: activeStack } } } },
          })
          setServices(serviceResult.entries)
        } else {
          setServices([])
        }
      } catch (error) {
        injector.getInstance(NotyService).emit('onNotyAdded', {
          title: 'Error',
          body: error instanceof Error ? error.message : 'Failed to load data',
          type: 'error',
        })
      }
      setIsLoading(false)
    }

    if (isLoading && refreshTrigger.getValue() === 0) {
      void loadData()
      refreshTrigger.setValue(1)
    }

    const refresh = () => {
      void loadData()
    }

    if (stacks.length === 0 && !isLoading) {
      return (
        <PageContainer>
          <PageHeader
            icon="🏠"
            title="Dashboard"
            description="No stacks yet. Create a stack to start managing your services."
            actions={
              <div>
                <Button variant="contained" onclick={() => history.pushState(null, '', '/stacks/create')}>
                  Create Stack
                </Button>
                <NestedRouteLink href="/stacks/import">
                  <Button variant="outlined">Import Stack</Button>
                </NestedRouteLink>
              </div>
            }
          />
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              height: '40vh',
              gap: '12px',
            }}
          >
            <Button variant="contained" onclick={() => history.pushState(null, '', '/stacks/create')}>
              Create Stack
            </Button>
            <NestedRouteLink href="/stacks/import">
              <Button variant="outlined">Import Stack</Button>
            </NestedRouteLink>
          </div>
        </PageContainer>
      )
    }

    const currentStack = stacks.find((s) => s.name === selectedStackName)

    return (
      <div>
        <PageHeader
          icon="🏠"
          title={currentStack?.displayName ?? 'Dashboard'}
          actions={
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <StackSelector
                stacks={stacks}
                selectedStack={selectedStackName}
                onSelect={(name) => {
                  setSelectedStackName(name)
                  void loadData()
                }}
              />
              <Button variant="outlined" onclick={refresh} startIcon={<Icon icon={icons.refresh} size="small" />}>
                Refresh
              </Button>
            </div>
          }
        />
        <div style={{ padding: '16px' }}>
          <ServiceTable
            services={services}
            onRefresh={refresh}
            onViewLogs={(serviceId) => history.pushState(null, '', `/services/${serviceId}/logs`)}
            onEdit={(serviceId) => history.pushState(null, '', `/services/${serviceId}`)}
          />
        </div>
      </div>
    )
  },
})
