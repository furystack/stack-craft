import { useCollectionSync } from '../../services/entity-sync.js'
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
  detectSecretsInServiceDefinition,
  GitHubRepository,
  mergeServiceView,
  Prerequisite,
  ServiceConfig,
  ServiceDefinition,
  ServiceDependencyLink,
  ServiceGitStatus,
  ServicePrerequisiteLink,
  ServiceStatus,
} from 'common'

import { StackCraftNestedRouteLink } from '../../components/app-routes.js'
import { BulkActionBar } from '../../components/bulk-action-bar.js'
import { SecretWarningsCard } from '../../components/secret-warnings-card.js'
import { ServiceFilters } from '../../components/service-filters.js'
import { ServiceTable } from '../../components/service-table.js'
import { getServiceSummaryStatus } from '../../utils/service-pipeline.js'
import { ServicesEmptyState } from './services-empty-state.js'
import { StackActionsMenu } from './stack-actions-menu.js'

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

    const reposState = useCollectionSync(options, GitHubRepository, {
      filter: { stackName: { $eq: props.stackName } },
    })
    const repos = reposState.status === 'synced' || reposState.status === 'cached' ? reposState.data.entries : []

    const prereqsState = useCollectionSync(options, Prerequisite, {
      filter: { stackName: { $eq: props.stackName } },
    })
    const prereqs =
      prereqsState.status === 'synced' || prereqsState.status === 'cached' ? prereqsState.data.entries : []

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

    const [searchText, setSearchText] = options.useState('searchText', '')
    const [statusFilter, setStatusFilter] = options.useState('statusFilter', '')

    const filteredServices = services.filter((s) => {
      if (searchText) {
        const term = searchText.toLowerCase()
        const matchesText =
          s.displayName.toLowerCase().includes(term) ||
          (s.description?.toLowerCase().includes(term) ?? false) ||
          (s.currentBranch?.toLowerCase().includes(term) ?? false)
        if (!matchesText) return false
      }
      if (statusFilter) {
        if (getServiceSummaryStatus(s) !== statusFilter) return false
      }
      return true
    })

    const isFiltered = searchText !== '' || statusFilter !== ''
    const title = isFiltered
      ? `Services (${filteredServices.length} / ${services.length})`
      : `Services (${services.length})`

    const clearFilters = () => {
      setSearchText('')
      setStatusFilter('')
    }

    const warningGroups = defs
      .map((def) => {
        const warnings = detectSecretsInServiceDefinition({
          files: def.files,
          runCommand: def.runCommand,
          installCommand: def.installCommand,
          buildCommand: def.buildCommand,
        })
        return {
          serviceId: def.id,
          serviceName: def.displayName,
          stackName: props.stackName,
          warnings,
        }
      })
      .filter((g) => g.warnings.length > 0)

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
          title={title}
          actions={
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              {services.length > 0 ? (
                <ServiceFilters
                  filteredServices={filteredServices}
                  searchText={searchText}
                  onSearchTextChange={setSearchText}
                  statusFilter={statusFilter}
                  onStatusFilterChange={setStatusFilter}
                />
              ) : null}
              {services.length > 0 ? <BulkActionBar collectionService={collectionService} /> : null}
              <StackActionsMenu stackName={props.stackName} />
              <StackCraftNestedRouteLink
                path="/stacks/:stackName/services/wizard"
                params={{ stackName: props.stackName }}
              >
                <Button variant="contained" size="small" startIcon={<Icon icon={icons.plus} size="small" />}>
                  Create Service
                </Button>
              </StackCraftNestedRouteLink>
            </div>
          }
        />
        {warningGroups.length > 0 ? <SecretWarningsCard warningGroups={warningGroups} /> : null}
        {services.length === 0 ? (
          <ServicesEmptyState stackName={props.stackName} repoCount={repos.length} prereqCount={prereqs.length} />
        ) : filteredServices.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '32px', opacity: '0.7' }}>
            No matching services.
            <div style={{ marginTop: '12px' }}>
              <Button variant="outlined" size="small" onclick={clearFilters}>
                Clear Filters
              </Button>
            </div>
          </div>
        ) : (
          <ServiceTable services={filteredServices} collectionService={collectionService} />
        )}
      </PageContainer>
    )
  },
})
