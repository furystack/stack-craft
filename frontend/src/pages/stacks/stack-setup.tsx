import type { FindOptions } from '@furystack/core'
import { useCollectionSync } from '@furystack/entity-sync-client'
import { createComponent, Shade } from '@furystack/shades'

import {
  Button,
  CollectionService,
  cssVariableTheme,
  DataGrid,
  Icon,
  icons,
  Loader,
  NotyService,
  PageContainer,
  PageHeader,
  Paper,
} from '@furystack/shades-common-components'
import type { ServiceView } from 'common'
import { mergeServiceView, ServiceConfig, ServiceDefinition, ServiceStatus, StackDefinition } from 'common'

import { StackCraftNestedRouteLink } from '../../components/app-routes.js'
import { BuildStatusChip, CloneStatusChip, InstallStatusChip, RunStatusChip } from '../../components/status-chips.js'
import { ServicesApiClient } from '../../services/api-clients/services-api-client.js'
import { StacksApiClient } from '../../services/api-clients/stacks-api-client.js'
import { isServiceReady } from '../../utils/is-service-ready.js'

type StackSetupProps = {
  stackName: string
}

type StackSetupColumn = 'service' | 'clone' | 'install' | 'build' | 'run' | 'actions'

const isServiceInProgress = (svc: ServiceView): boolean => {
  return svc.cloneStatus === 'cloning' || svc.installStatus === 'installing' || svc.buildStatus === 'building'
}

export const StackSetup = Shade<StackSetupProps>({
  customElementName: 'shade-stack-setup',
  render: (options) => {
    const { props, injector, useDisposable, useState } = options

    const stacksState = useCollectionSync(options, StackDefinition, {
      filter: { name: { $eq: props.stackName } },
    })
    const stacks = stacksState.status === 'synced' || stacksState.status === 'cached' ? stacksState.data.entries : []
    const currentStack = stacks[0]

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

    const services: ServiceView[] = defs.map((def) =>
      mergeServiceView(def, configMap.get(def.id), statusMap.get(def.id)),
    )

    const collectionService = useDisposable(
      'stackSetupCollectionService',
      () => new CollectionService<ServiceView>({ searchField: 'displayName', idField: 'id' }),
    )

    const [findOptions, setFindOptions] = useState<FindOptions<ServiceView, Array<keyof ServiceView>>>(
      'stackSetupFindOptions',
      { top: Infinity },
    )

    collectionService.data.setValue({ entries: services, count: services.length })

    const isLoading = stacksState.status === 'connecting' || servicesState.status === 'connecting'

    const [isBatchRunning, setIsBatchRunning] = useState('isBatchRunning', false)
    const [setupTriggered, setSetupTriggered] = useState<Set<string>>('setupTriggered', new Set())

    const allReady = services.length > 0 && services.every(isServiceReady)
    const anyInProgress = services.some(isServiceInProgress) || isBatchRunning

    const triggerSetup = async (serviceId: string) => {
      setSetupTriggered(new Set([...setupTriggered, serviceId]))
      try {
        await injector.getInstance(ServicesApiClient).call({
          method: 'POST',
          action: '/services/:id/setup',
          url: { id: serviceId },
        })
      } catch (error) {
        injector.getInstance(NotyService).emit('onNotyAdded', {
          title: 'Setup failed',
          body: error instanceof Error ? error.message : 'Setup error',
          type: 'error',
        })
      }
    }

    const triggerSetupAll = async () => {
      setIsBatchRunning(true)
      try {
        await injector.getInstance(StacksApiClient).call({
          method: 'POST',
          action: '/stacks/:id/setup',
          url: { id: props.stackName },
        })
      } catch (error) {
        injector.getInstance(NotyService).emit('onNotyAdded', {
          title: 'Batch setup failed',
          body: error instanceof Error ? error.message : 'Setup error',
          type: 'error',
        })
      }
      setIsBatchRunning(false)
    }

    const [isStartingAll, setIsStartingAll] = useState('isStartingAll', false)

    const triggerStartAll = async () => {
      setIsStartingAll(true)
      const api = injector.getInstance(ServicesApiClient)
      for (const svc of services) {
        if (isServiceReady(svc) && svc.runStatus === 'stopped') {
          try {
            await api.call({ method: 'POST', action: '/services/:id/start', url: { id: svc.id } })
          } catch {
            // Individual failures tracked by entity-sync
          }
        }
      }
      setIsStartingAll(false)
    }

    if (isLoading) {
      return (
        <PageContainer>
          <div style={{ display: 'flex', justifyContent: 'center', padding: '48px' }}>
            <Loader />
          </div>
        </PageContainer>
      )
    }

    return (
      <PageContainer>
        <PageHeader
          icon={<Icon icon={icons.settings} />}
          title={`Set Up: ${currentStack?.displayName ?? props.stackName}`}
          description="Clone repositories, install packages, and build services."
          actions={
            <div style={{ display: 'flex', gap: '8px' }}>
              {allReady ? (
                <Button
                  variant="contained"
                  size="small"
                  color="success"
                  loading={isStartingAll}
                  onclick={() => void triggerStartAll()}
                  startIcon={<Icon icon={icons.play} size="small" />}
                >
                  Start All Services
                </Button>
              ) : (
                <Button
                  variant="contained"
                  size="small"
                  loading={anyInProgress}
                  onclick={() => void triggerSetupAll()}
                  startIcon={<Icon icon={icons.settings} size="small" />}
                >
                  Set Up All Services
                </Button>
              )}
              <StackCraftNestedRouteLink path="/stacks/:stackName" params={{ stackName: props.stackName }}>
                <Button variant="outlined" size="small" startIcon={<Icon icon={icons.home} size="small" />}>
                  Go to Dashboard
                </Button>
              </StackCraftNestedRouteLink>
            </div>
          }
        />

        <Paper>
          {services.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '32px', color: cssVariableTheme.text.secondary }}>
              No services in this stack.
            </div>
          ) : (
            <DataGrid<ServiceView, StackSetupColumn>
              columns={['service', 'clone', 'install', 'build', 'run', 'actions']}
              findOptions={findOptions}
              onFindOptionsChange={setFindOptions}
              styles={undefined}
              collectionService={collectionService}
              paginationOptions={[Infinity]}
              headerComponents={{
                service: () => <span>Service</span>,
                clone: () => <span style={{ display: 'block', textAlign: 'center', width: '100%' }}>Clone</span>,
                install: () => <span style={{ display: 'block', textAlign: 'center', width: '100%' }}>Install</span>,
                build: () => <span style={{ display: 'block', textAlign: 'center', width: '100%' }}>Build</span>,
                run: () => <span style={{ display: 'block', textAlign: 'center', width: '100%' }}>Run</span>,
                actions: () => <span style={{ display: 'block', textAlign: 'right', width: '100%' }}>Actions</span>,
              }}
              rowComponents={{
                service: (svc) => (
                  <div>
                    <div style={{ fontWeight: 'bold', fontSize: '14px' }}>{svc.displayName}</div>
                    {svc.description ? (
                      <div style={{ fontSize: '12px', color: cssVariableTheme.text.secondary, marginTop: '2px' }}>
                        {svc.description}
                      </div>
                    ) : null}
                  </div>
                ),
                clone: (svc) => (
                  <div style={{ textAlign: 'center' }}>
                    <CloneStatusChip status={svc.cloneStatus} />
                  </div>
                ),
                install: (svc) => (
                  <div style={{ textAlign: 'center' }}>
                    <InstallStatusChip status={svc.installStatus} />
                  </div>
                ),
                build: (svc) => (
                  <div style={{ textAlign: 'center' }}>
                    <BuildStatusChip status={svc.buildStatus} />
                  </div>
                ),
                run: (svc) => (
                  <div style={{ textAlign: 'center' }}>
                    <RunStatusChip status={svc.runStatus} />
                  </div>
                ),
                actions: (svc) => {
                  const ready = isServiceReady(svc)
                  const inProgress = isServiceInProgress(svc) || setupTriggered.has(svc.id)
                  return (
                    <div
                      style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end' }}
                      onclick={(e: MouseEvent) => e.stopPropagation()}
                    >
                      {ready ? (
                        <StackCraftNestedRouteLink
                          path="/stacks/:stackName/services/:serviceId"
                          params={{ stackName: props.stackName, serviceId: svc.id }}
                        >
                          <Button
                            variant="outlined"
                            size="small"
                            color="success"
                            startIcon={<Icon icon={icons.checkCircle} size="small" />}
                          >
                            Ready
                          </Button>
                        </StackCraftNestedRouteLink>
                      ) : (
                        <Button
                          variant="outlined"
                          size="small"
                          loading={inProgress}
                          onclick={() => void triggerSetup(svc.id)}
                          startIcon={<Icon icon={icons.settings} size="small" />}
                        >
                          Set Up
                        </Button>
                      )}
                      <StackCraftNestedRouteLink
                        path="/stacks/:stackName/services/:serviceId/logs"
                        params={{ stackName: props.stackName, serviceId: svc.id }}
                      >
                        <Button variant="outlined" size="small" startIcon={<Icon icon={icons.fileText} size="small" />}>
                          Logs
                        </Button>
                      </StackCraftNestedRouteLink>
                    </div>
                  )
                },
              }}
            />
          )}
        </Paper>
      </PageContainer>
    )
  },
})
