import { useCollectionSync } from '@furystack/entity-sync-client'
import { createComponent, Shade } from '@furystack/shades'
import {
  Button,
  CollectionService,
  Icon,
  icons,
  Loader,
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
import { BulkActionBar } from '../../components/bulk-action-bar.js'
import { ServiceTable } from '../../components/service-table.js'

type ServicesListProps = {
  stackName: string
}

export const ServicesList = Shade<ServicesListProps>({
  customElementName: 'shade-services-list',
  render: (options) => {
    const { props, useDisposable } = options

    const collectionService = useDisposable(
      'collectionService',
      () => new CollectionService<ServiceView>({ searchField: 'displayName', idField: 'id' }),
    )

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
              <BulkActionBar collectionService={collectionService} />
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
          <ServiceTable services={services} collectionService={collectionService} />
        )}
      </PageContainer>
    )
  },
})
