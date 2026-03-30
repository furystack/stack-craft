import { useCollectionSync } from '@furystack/entity-sync-client'
import { createComponent, Shade } from '@furystack/shades'
import {
  Button,
  ButtonGroup,
  Icon,
  icons,
  Loader,
  NotyService,
  PageContainer,
  PageHeader,
} from '@furystack/shades-common-components'
import type { ServiceView } from 'common'
import {
  mergeServiceView,
  ServiceConfig,
  ServiceDefinition,
  ServiceDependencyLink,
  ServiceGitStatus,
  ServicePrerequisiteLink,
  ServiceStatus,
} from 'common'

import { StackCraftNestedRouteLink } from '../../components/app-routes.js'
import { ServiceTable } from '../../components/service-table.js'
import { ServicesApiClient } from '../../services/api-clients/services-api-client.js'

type ServicesListProps = {
  stackName: string
}

export const ServicesList = Shade<ServicesListProps>({
  customElementName: 'shade-services-list',
  render: (options) => {
    const { props, injector } = options

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

    const gitStatusState = useCollectionSync(options, ServiceGitStatus, {})
    const gitStatuses =
      gitStatusState.status === 'synced' || gitStatusState.status === 'cached' ? gitStatusState.data.entries : []

    const prereqLinksState = useCollectionSync(options, ServicePrerequisiteLink, {})
    const prereqLinks =
      prereqLinksState.status === 'synced' || prereqLinksState.status === 'cached' ? prereqLinksState.data.entries : []
    const depLinksState = useCollectionSync(options, ServiceDependencyLink, {})
    const depLinks =
      depLinksState.status === 'synced' || depLinksState.status === 'cached' ? depLinksState.data.entries : []

    const statusMap = new Map(statuses.map((s) => [s.serviceId, s]))
    const configMap = new Map(configs.map((c) => [c.serviceId, c]))
    const gitStatusMap = new Map(gitStatuses.map((g) => [g.serviceId, g]))

    const services = defs.map((def) => {
      const relations = {
        prerequisiteIds: prereqLinks.filter((l) => l.serviceId === def.id).map((l) => l.prerequisiteId),
        prerequisiteServiceIds: depLinks.filter((l) => l.serviceId === def.id).map((l) => l.dependsOnServiceId),
      }
      return mergeServiceView(def, configMap.get(def.id), statusMap.get(def.id), gitStatusMap.get(def.id), relations)
    })

    const isLoading = servicesState.status === 'connecting'
    const api = injector.getInstance(ServicesApiClient)
    const noty = injector.getInstance(NotyService)
    const [selectedServiceIds, setSelectedServiceIds] = options.useState<string[]>('selectedServiceIds', [])
    const [isBulkLoading, setIsBulkLoading] = options.useState('isBulkLoading', false)

    const selectedServices = services.filter((s) => selectedServiceIds.includes(s.id))
    const hasRunning = selectedServices.some((s) => s.runStatus === 'running')
    const hasStopped = selectedServices.some((s) => s.runStatus !== 'running')
    const hasSelection = selectedServices.length > 0

    const bulkAction = async (action: string) => {
      setIsBulkLoading(true)
      const failures: string[] = []
      for (const svc of selectedServices) {
        try {
          await api.call({
            method: 'POST',
            action: `/services/:id/${action}` as '/services/:id/start',
            url: { id: svc.id },
          })
        } catch {
          failures.push(svc.displayName)
        }
      }
      if (failures.length > 0) {
        noty.emit('onNotyAdded', {
          title: `${action} failed`,
          body: `Failed for: ${failures.join(', ')}`,
          type: 'error',
        })
      }
      setIsBulkLoading(false)
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
          icon={<Icon icon={icons.code} />}
          title={`Services (${services.length})`}
          actions={
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
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
                    title="Clone, install, and build (initial provisioning)"
                    onclick={() => void bulkAction('setup')}
                    startIcon={<Icon icon={icons.settings} size="small" />}
                  >
                    Set Up
                  </Button>
                  {hasRunning ? (
                    <Button
                      size="small"
                      color="warning"
                      loading={isBulkLoading}
                      onclick={() => void bulkAction('restart')}
                      startIcon={<Icon icon={icons.refresh} size="small" />}
                    >
                      Restart
                    </Button>
                  ) : null}
                  <Button
                    size="small"
                    loading={isBulkLoading}
                    title="Pull, install, build, and restart if running"
                    onclick={() => void bulkAction('update')}
                    startIcon={<Icon icon={icons.download} size="small" />}
                  >
                    Update
                  </Button>
                </ButtonGroup>
              ) : null}
              <StackCraftNestedRouteLink
                href="/stacks/:stackName/services/wizard"
                params={{ stackName: props.stackName }}
              >
                <Button variant="contained" size="small" startIcon={<Icon icon={icons.plus} size="small" />}>
                  Create Service
                </Button>
              </StackCraftNestedRouteLink>
            </div>
          }
        />
        {services.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '32px', opacity: '0.7' }}>
            No services in this stack yet.
            <div style={{ marginTop: '12px' }}>
              <StackCraftNestedRouteLink
                href="/stacks/:stackName/services/wizard"
                params={{ stackName: props.stackName }}
              >
                <Button variant="outlined" size="small" startIcon={<Icon icon={icons.plus} size="small" />}>
                  Create Service
                </Button>
              </StackCraftNestedRouteLink>
            </div>
          </div>
        ) : (
          <ServiceTable
            services={services}
            onSelectionChange={(selected: ServiceView[]) => {
              setSelectedServiceIds(selected.map((s) => s.id))
            }}
          />
        )}
      </PageContainer>
    )
  },
})
