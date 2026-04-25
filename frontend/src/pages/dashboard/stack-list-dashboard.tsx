import { useCollectionSync } from '../../services/entity-sync.js'
import { createComponent, Shade } from '@furystack/shades'

import {
  Button,
  Card,
  CardContent,
  CardHeader,
  Chip,
  cssVariableTheme,
  Icon,
  icons,
  MarkdownDisplay,
  NotyService,
  PageContainer,
  PageHeader,
} from '@furystack/shades-common-components'
import type { ServiceView, StackDefinition } from 'common'
import {
  mergeServiceView,
  Prerequisite,
  PrerequisiteCheckResult,
  ServiceConfig,
  ServiceDefinition,
  ServiceGitStatus,
  ServiceStatus,
} from 'common'

import { StackCraftNestedRouteLink } from '../../components/app-routes.js'
import { ServicesApiClient } from '../../services/api-clients/services-api-client.js'
import { isServiceReady } from '../../utils/is-service-ready.js'

type StackListDashboardProps = {
  stacks: StackDefinition[]
}

export const StackListDashboard = Shade<StackListDashboardProps>({
  customElementName: 'stack-list-dashboard',
  render: (options) => {
    const { props, injector, useState } = options
    const { stacks } = props

    const allDefsState = useCollectionSync(options, ServiceDefinition, {})
    const allDefs =
      allDefsState.status === 'synced' || allDefsState.status === 'cached' ? allDefsState.data.entries : []

    const allStatusesState = useCollectionSync(options, ServiceStatus, {})
    const allStatuses =
      allStatusesState.status === 'synced' || allStatusesState.status === 'cached' ? allStatusesState.data.entries : []

    const allConfigsState = useCollectionSync(options, ServiceConfig, {})
    const allConfigs =
      allConfigsState.status === 'synced' || allConfigsState.status === 'cached' ? allConfigsState.data.entries : []

    const allGitState = useCollectionSync(options, ServiceGitStatus, {})
    const allGitStatuses =
      allGitState.status === 'synced' || allGitState.status === 'cached' ? allGitState.data.entries : []

    const allPrereqsState = useCollectionSync(options, Prerequisite, {})
    const allPrereqs =
      allPrereqsState.status === 'synced' || allPrereqsState.status === 'cached' ? allPrereqsState.data.entries : []

    const allCheckResultsState = useCollectionSync(options, PrerequisiteCheckResult, {})
    const allCheckResults =
      allCheckResultsState.status === 'synced' || allCheckResultsState.status === 'cached'
        ? allCheckResultsState.data.entries
        : []

    const allStatusMap = new Map(allStatuses.map((s) => [s.serviceId, s]))
    const allConfigMap = new Map(allConfigs.map((c) => [c.serviceId, c]))
    const allGitMap = new Map(allGitStatuses.map((g) => [g.serviceId, g]))
    const allCheckMap = new Map(allCheckResults.map((r) => [r.prerequisiteId, r]))

    const allServices: ServiceView[] = allDefs.map((def) =>
      mergeServiceView(def, allConfigMap.get(def.id), allStatusMap.get(def.id), allGitMap.get(def.id)),
    )

    const servicesByStack = new Map<string, ServiceView[]>()
    for (const svc of allServices) {
      const list = servicesByStack.get(svc.stackName) ?? []
      list.push(svc)
      servicesByStack.set(svc.stackName, list)
    }

    const prereqsByStack = new Map<string, typeof allPrereqs>()
    for (const prereq of allPrereqs) {
      const list = prereqsByStack.get(prereq.stackName) ?? []
      list.push(prereq)
      prereqsByStack.set(prereq.stackName, list)
    }

    const globalRunningCount = allServices.filter((s) => s.runStatus === 'running').length
    const globalStoppedCount = allServices.filter((s) => s.runStatus === 'stopped').length
    const globalErrorCount = allServices.filter((s) => s.runStatus === 'error').length
    const globalClonedCount = allServices.filter((s) => s.repositoryId && s.cloneStatus === 'cloned').length

    const [isStartingAll, setIsStartingAll] = useState('globalIsStartingAll', false)
    const [isStoppingAll, setIsStoppingAll] = useState('globalIsStoppingAll', false)
    const [isUpdatingAll, setIsUpdatingAll] = useState('globalIsUpdatingAll', false)

    const api = injector.get(ServicesApiClient)
    const noty = injector.get(NotyService)

    const triggerGlobalStartAll = async () => {
      setIsStartingAll(true)
      const failures: string[] = []
      for (const svc of allServices) {
        if (isServiceReady(svc) && svc.runStatus === 'stopped') {
          try {
            await api.call({ method: 'POST', action: '/services/:id/start', url: { id: svc.id } })
          } catch {
            failures.push(svc.displayName)
          }
        }
      }
      if (failures.length > 0) {
        noty.emit('onNotyAdded', {
          title: 'Start failed',
          body: `Failed for: ${failures.join(', ')}`,
          type: 'error',
        })
      }
      setIsStartingAll(false)
    }

    const triggerGlobalStopAll = async () => {
      setIsStoppingAll(true)
      const failures: string[] = []
      for (const svc of allServices) {
        if (svc.runStatus === 'running') {
          try {
            await api.call({ method: 'POST', action: '/services/:id/stop', url: { id: svc.id } })
          } catch {
            failures.push(svc.displayName)
          }
        }
      }
      if (failures.length > 0) {
        noty.emit('onNotyAdded', {
          title: 'Stop failed',
          body: `Failed for: ${failures.join(', ')}`,
          type: 'error',
        })
      }
      setIsStoppingAll(false)
    }

    const triggerGlobalUpdateAll = async () => {
      setIsUpdatingAll(true)
      const failures: string[] = []
      for (const svc of allServices) {
        if (svc.repositoryId && svc.cloneStatus === 'cloned') {
          try {
            await api.call({ method: 'POST', action: '/services/:id/update', url: { id: svc.id } })
          } catch {
            failures.push(svc.displayName)
          }
        }
      }
      if (failures.length > 0) {
        noty.emit('onNotyAdded', {
          title: 'Update failed',
          body: `Failed for: ${failures.join(', ')}`,
          type: 'error',
        })
      }
      setIsUpdatingAll(false)
    }

    return (
      <PageContainer>
        <PageHeader
          icon="🏠"
          title="Dashboard"
          description={
            stacks.length > 0
              ? `You have ${stacks.length} stack${stacks.length === 1 ? '' : 's'} configured.`
              : 'No stacks yet. Create a stack to start managing your services.'
          }
          actions={
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              {allServices.length > 0 ? (
                <div style={{ display: 'contents' }}>
                  <Button
                    variant="contained"
                    size="small"
                    color="success"
                    disabled={globalStoppedCount === 0 && globalErrorCount === 0}
                    loading={isStartingAll}
                    onclick={() => void triggerGlobalStartAll()}
                    startIcon={<Icon icon={icons.play} size="small" />}
                  >
                    Start All
                  </Button>
                  <Button
                    variant="outlined"
                    size="small"
                    disabled={globalRunningCount === 0}
                    loading={isStoppingAll}
                    onclick={() => void triggerGlobalStopAll()}
                    startIcon={<Icon icon={icons.stopCircle} size="small" />}
                  >
                    Stop All
                  </Button>
                  <Button
                    variant="outlined"
                    size="small"
                    disabled={globalClonedCount === 0}
                    loading={isUpdatingAll}
                    onclick={() => void triggerGlobalUpdateAll()}
                    startIcon={<Icon icon={icons.download} size="small" />}
                  >
                    Update All
                  </Button>
                </div>
              ) : null}
              <StackCraftNestedRouteLink path="/stacks/create">
                <Button variant="contained" size="small" startIcon={<Icon icon={icons.plus} size="small" />}>
                  Create Stack
                </Button>
              </StackCraftNestedRouteLink>
              <StackCraftNestedRouteLink path="/stacks/import">
                <Button variant="outlined" size="small" startIcon={<Icon icon={icons.upload} size="small" />}>
                  Import Stack
                </Button>
              </StackCraftNestedRouteLink>
            </div>
          }
        />
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))',
            gap: '16px',
          }}
        >
          {stacks.map((stack) => {
            const stackServices = servicesByStack.get(stack.name) ?? []
            const stackPrereqs = prereqsByStack.get(stack.name) ?? []

            const running = stackServices.filter((s) => s.runStatus === 'running').length
            const stopped = stackServices.filter((s) => s.runStatus === 'stopped').length
            const errored = stackServices.filter((s) => s.runStatus === 'error').length
            const starting = stackServices.filter((s) => s.runStatus === 'starting').length
            const stopping = stackServices.filter((s) => s.runStatus === 'stopping').length

            const satisfied = stackPrereqs.filter((p) => allCheckMap.get(p.id)?.status === 'satisfied').length
            const failed = stackPrereqs.filter((p) => allCheckMap.get(p.id)?.status === 'failed').length
            const unchecked = stackPrereqs.length - satisfied - failed

            return (
              <StackCraftNestedRouteLink
                path="/stacks/:stackName"
                params={{ stackName: stack.name }}
                style={{ textDecoration: 'none', color: 'inherit' }}
              >
                <Card variant="outlined" clickable style={{ height: '100%' }}>
                  <CardHeader
                    title={stack.displayName}
                    avatar={<Icon icon={icons.layers} />}
                    action={<Icon icon={icons.chevronRight} size="small" />}
                  />
                  <CardContent>
                    {stackServices.length > 0 ? (
                      <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '8px' }}>
                        <Chip variant="outlined" size="small" color="secondary">
                          {stackServices.length} service{stackServices.length !== 1 ? 's' : ''}
                        </Chip>
                        {running > 0 ? (
                          <Chip variant="outlined" size="small" color="success">
                            {running} running
                          </Chip>
                        ) : null}
                        {starting > 0 ? (
                          <Chip variant="outlined" size="small" color="warning">
                            {starting} starting
                          </Chip>
                        ) : null}
                        {stopping > 0 ? (
                          <Chip variant="outlined" size="small" color="warning">
                            {stopping} stopping
                          </Chip>
                        ) : null}
                        {stopped > 0 ? (
                          <Chip variant="outlined" size="small" color="secondary">
                            {stopped} stopped
                          </Chip>
                        ) : null}
                        {errored > 0 ? (
                          <Chip variant="outlined" size="small" color="error">
                            {errored} error
                          </Chip>
                        ) : null}
                      </div>
                    ) : (
                      <div
                        style={{
                          fontSize: cssVariableTheme.typography.fontSize.sm,
                          color: cssVariableTheme.text.secondary,
                          marginBottom: '8px',
                        }}
                      >
                        No services yet
                      </div>
                    )}
                    {stackPrereqs.length > 0 ? (
                      <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                        {satisfied > 0 ? (
                          <Chip variant="outlined" size="small" color="success">
                            {satisfied} satisfied
                          </Chip>
                        ) : null}
                        {failed > 0 ? (
                          <Chip variant="outlined" size="small" color="error">
                            {failed} failed
                          </Chip>
                        ) : null}
                        {unchecked > 0 ? (
                          <Chip variant="outlined" size="small" color="secondary">
                            {unchecked} unchecked
                          </Chip>
                        ) : null}
                      </div>
                    ) : null}
                    {stack.description ? (
                      <div
                        style={{
                          marginTop: '8px',
                          fontSize: cssVariableTheme.typography.fontSize.sm,
                          color: cssVariableTheme.text.secondary,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          display: '-webkit-box',
                          webkitLineClamp: '2',
                          webkitBoxOrient: 'vertical',
                        }}
                      >
                        <MarkdownDisplay content={stack.description} />
                      </div>
                    ) : null}
                  </CardContent>
                </Card>
              </StackCraftNestedRouteLink>
            )
          })}
        </div>
      </PageContainer>
    )
  },
})
