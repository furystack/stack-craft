import { createComponent, Shade } from '@furystack/shades'
import { Button, NotyService } from '@furystack/shades-common-components'
import { ObservableValue } from '@furystack/utils'
import type { Service, Stack } from 'common'
import { StacksApiClient } from '../../services/api-clients/stacks-api-client.js'
import { ServicesApiClient } from '../../services/api-clients/services-api-client.js'
import { ServiceTable } from '../../components/service-table.js'
import { StackSelector } from '../../components/stack-selector.js'

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
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            height: '60vh',
            gap: '16px',
          }}
        >
          <h2 style={{ margin: '0', opacity: '0.7' }}>No stacks yet</h2>
          <p style={{ opacity: '0.5', margin: '0' }}>Create a stack to start managing your services.</p>
          <div style={{ display: 'flex', gap: '8px' }}>
            <Button variant="contained" onclick={() => history.pushState(null, '', '/stacks/create')}>
              Create Stack
            </Button>
            <Button variant="outlined" onclick={() => history.pushState(null, '', '/stacks/import')}>
              Import Stack
            </Button>
          </div>
        </div>
      )
    }

    const currentStack = stacks.find((s) => s.name === selectedStackName)

    return (
      <div style={{ padding: '0 24px' }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '16px',
            padding: '16px 0',
            borderBottom: '1px solid rgba(255,255,255,0.08)',
            marginBottom: '16px',
          }}
        >
          <h2 style={{ margin: '0', fontSize: '20px' }}>{currentStack?.displayName ?? 'Dashboard'}</h2>
          <StackSelector
            stacks={stacks}
            selectedStack={selectedStackName}
            onSelect={(name) => {
              setSelectedStackName(name)
              void loadData()
            }}
          />
          <div style={{ flex: '1' }} />
          <Button variant="outlined" onclick={refresh}>
            Refresh
          </Button>
        </div>
        <ServiceTable
          services={services}
          onRefresh={refresh}
          onViewLogs={(serviceId) => history.pushState(null, '', `/services/${serviceId}/logs`)}
          onEdit={(serviceId) => history.pushState(null, '', `/services/${serviceId}`)}
        />
      </div>
    )
  },
})
