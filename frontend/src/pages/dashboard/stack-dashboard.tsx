import { useCollectionSync } from '@furystack/entity-sync-client'
import { createComponent, Shade } from '@furystack/shades'

import type { Palette } from '@furystack/shades-common-components'
import {
  Button,
  Card,
  CardActions,
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
  Paper,
} from '@furystack/shades-common-components'
import type { PrerequisiteCheckStatus, ServiceView, StackDefinition } from 'common'
import {
  GitHubRepository,
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
import { ServiceRow } from './service-row.js'

const prereqStatusColor: Record<PrerequisiteCheckStatus, keyof Palette> = {
  unchecked: 'secondary',
  checking: 'warning',
  satisfied: 'success',
  failed: 'error',
}

type StackDashboardProps = {
  stackName: string
  stacks: StackDefinition[]
}

export const StackDashboard = Shade<StackDashboardProps>({
  customElementName: 'stack-dashboard',
  render: (options) => {
    const { props, injector, useState } = options
    const { stackName, stacks } = props
    const currentStack = stacks.find((s) => s.name === stackName)

    const servicesState = useCollectionSync(options, ServiceDefinition, {
      filter: { stackName: { $eq: stackName } },
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

    const statusMap = new Map(statuses.map((s) => [s.serviceId, s]))
    const configMap = new Map(configs.map((c) => [c.serviceId, c]))
    const gitStatusMap = new Map(gitStatuses.map((g) => [g.serviceId, g]))

    const services: ServiceView[] = defs.map((def) =>
      mergeServiceView(def, configMap.get(def.id), statusMap.get(def.id), gitStatusMap.get(def.id)),
    )

    const reposState = useCollectionSync(options, GitHubRepository, {
      filter: { stackName: { $eq: stackName } },
    })
    const repos = reposState.status === 'synced' || reposState.status === 'cached' ? reposState.data.entries : []

    const prereqsState = useCollectionSync(options, Prerequisite, {
      filter: { stackName: { $eq: stackName } },
    })
    const prereqs =
      prereqsState.status === 'synced' || prereqsState.status === 'cached' ? prereqsState.data.entries : []

    const checkResultsState = useCollectionSync(options, PrerequisiteCheckResult, {})
    const checkResults =
      checkResultsState.status === 'synced' || checkResultsState.status === 'cached'
        ? checkResultsState.data.entries
        : []
    const checkResultMap = new Map(checkResults.map((r) => [r.prerequisiteId, r]))

    const runningCount = services.filter((s) => s.runStatus === 'running').length
    const stoppedCount = services.filter((s) => s.runStatus === 'stopped').length
    const startingCount = services.filter((s) => s.runStatus === 'starting').length
    const stoppingCount = services.filter((s) => s.runStatus === 'stopping').length
    const errorCount = services.filter((s) => s.runStatus === 'error').length

    const buildServicesSummary = (): string => {
      if (services.length === 0) return 'No services yet'
      const parts: string[] = []
      if (runningCount > 0) parts.push(`${runningCount} running`)
      if (startingCount > 0) parts.push(`${startingCount} starting`)
      if (stoppingCount > 0) parts.push(`${stoppingCount} stopping`)
      if (stoppedCount > 0) parts.push(`${stoppedCount} stopped`)
      if (errorCount > 0) parts.push(`${errorCount} error`)
      return parts.join(', ')
    }

    const buildPrereqsSummary = (): string => {
      if (prereqs.length === 0) return 'No prerequisites yet'
      const satisfiedCount = prereqs.filter((p) => checkResultMap.get(p.id)?.status === 'satisfied').length
      const failedCount = prereqs.filter((p) => checkResultMap.get(p.id)?.status === 'failed').length
      const parts: string[] = []
      if (satisfiedCount > 0) parts.push(`${satisfiedCount} satisfied`)
      if (failedCount > 0) parts.push(`${failedCount} failed`)
      const uncheckedCount = prereqs.length - satisfiedCount - failedCount
      if (uncheckedCount > 0) parts.push(`${uncheckedCount} unchecked`)
      return parts.join(', ')
    }

    const [isStartingAll, setIsStartingAll] = useState('isStartingAll', false)
    const [isStoppingAll, setIsStoppingAll] = useState('isStoppingAll', false)

    const api = injector.getInstance(ServicesApiClient)
    const noty = injector.getInstance(NotyService)

    const triggerStartAll = async () => {
      setIsStartingAll(true)
      const failures: string[] = []
      for (const svc of services) {
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

    const triggerStopAll = async () => {
      setIsStoppingAll(true)
      const failures: string[] = []
      for (const svc of services) {
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

    if (!currentStack) {
      return (
        <PageContainer>
          <PageHeader
            icon={<Icon icon={icons.layers} />}
            title="Stack not found"
            description={`No stack matches "${stackName}". It may have been removed or the URL may be wrong.`}
          />
          <Card variant="outlined">
            <CardContent style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <StackCraftNestedRouteLink href="/" style={{ textDecoration: 'none', alignSelf: 'flex-start' }}>
                <Button variant="contained" size="small" startIcon={<Icon icon={icons.home} size="small" />}>
                  Back to dashboard
                </Button>
              </StackCraftNestedRouteLink>
            </CardContent>
          </Card>
        </PageContainer>
      )
    }

    return (
      <PageContainer>
        <PageHeader
          icon={<Icon icon={icons.layers} />}
          title={currentStack.displayName}
          actions={
            <div style={{ display: 'flex', gap: '8px' }}>
              {services.length > 0 ? (
                <div style={{ display: 'contents' }}>
                  <Button
                    variant="contained"
                    size="small"
                    color="success"
                    disabled={stoppedCount === 0 && errorCount === 0}
                    loading={isStartingAll}
                    onclick={() => void triggerStartAll()}
                    startIcon={<Icon icon={icons.play} size="small" />}
                  >
                    Start All
                  </Button>
                  <Button
                    variant="outlined"
                    size="small"
                    disabled={runningCount === 0}
                    loading={isStoppingAll}
                    onclick={() => void triggerStopAll()}
                    startIcon={<Icon icon={icons.stopCircle} size="small" />}
                  >
                    Stop All
                  </Button>
                </div>
              ) : null}
              <StackCraftNestedRouteLink href="/stacks/:stackName/export" params={{ stackName }}>
                <Button variant="outlined" size="small" startIcon={<Icon icon={icons.download} size="small" />}>
                  Export
                </Button>
              </StackCraftNestedRouteLink>
              <StackCraftNestedRouteLink href="/stacks/:stackName/edit" params={{ stackName }}>
                <Button variant="outlined" size="small" startIcon={<Icon icon={icons.edit} size="small" />}>
                  Edit Stack
                </Button>
              </StackCraftNestedRouteLink>
            </div>
          }
        />
        {currentStack?.description ? (
          <Paper>
            <MarkdownDisplay content={currentStack.description} />
          </Paper>
        ) : null}

        {services.length === 0 ? (
          <Card variant="outlined">
            <CardHeader
              title="Getting Started"
              subheader="Set up your stack step by step"
              avatar={<Icon icon={icons.layers} />}
            />
            <CardContent style={{ display: 'flex', flexDirection: 'column', gap: '0' }}>
              {(
                [
                  {
                    step: 1,
                    title: 'Add Repositories',
                    description: 'Link GitHub repositories to clone',
                    isComplete: repos.length > 0,
                    summary:
                      repos.length > 0
                        ? `${repos.length} repositor${repos.length === 1 ? 'y' : 'ies'} configured`
                        : undefined,
                    href: '/stacks/:stackName/repositories' as const,
                    icon: icons.link,
                  },
                  {
                    step: 2,
                    title: 'Configure Prerequisites',
                    description: 'Set up environment requirements',
                    isComplete: prereqs.length > 0,
                    summary:
                      prereqs.length > 0
                        ? `${prereqs.length} prerequisite${prereqs.length === 1 ? '' : 's'} configured`
                        : undefined,
                    href: '/stacks/:stackName/prerequisites' as const,
                    icon: icons.check,
                  },
                  {
                    step: 3,
                    title: 'Create Services',
                    description: 'Define services that run from your repos',
                    isComplete: false,
                    summary: undefined,
                    href: '/stacks/:stackName/services/wizard' as const,
                    icon: icons.code,
                  },
                  {
                    step: 4,
                    title: 'Run Setup',
                    description: 'Clone, install, and build everything',
                    isComplete: false,
                    summary: undefined,
                    href: '/stacks/:stackName/setup' as const,
                    icon: icons.settings,
                  },
                ] as const
              ).map((item, index) => (
                <StackCraftNestedRouteLink
                  href={item.href}
                  params={{ stackName }}
                  style={{
                    textDecoration: 'none',
                    color: 'inherit',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    padding: '10px 4px',
                    borderTop: index > 0 ? `1px solid ${cssVariableTheme.divider}` : undefined,
                  }}
                >
                  <div
                    style={{
                      width: '28px',
                      height: '28px',
                      borderRadius: '50%',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: '0',
                      fontSize: '13px',
                      fontWeight: '600',
                      ...(item.isComplete
                        ? {
                            backgroundColor: cssVariableTheme.palette.success.main,
                            color: '#fff',
                          }
                        : {
                            border: `2px solid ${cssVariableTheme.divider}`,
                            color: cssVariableTheme.text.secondary,
                          }),
                    }}
                  >
                    {item.isComplete ? <Icon icon={icons.check} size={14} /> : item.step}
                  </div>
                  <div style={{ flex: '1', minWidth: '0' }}>
                    <div
                      style={{
                        fontWeight: '500',
                        fontSize: cssVariableTheme.typography.fontSize.md,
                        opacity: item.isComplete ? '0.6' : '1',
                      }}
                    >
                      {item.title}
                    </div>
                    <div
                      style={{
                        fontSize: cssVariableTheme.typography.fontSize.sm,
                        color: cssVariableTheme.text.secondary,
                        marginTop: '2px',
                      }}
                    >
                      {item.summary ?? item.description}
                    </div>
                  </div>
                  <Icon icon={item.icon} size="small" style={{ flexShrink: '0', opacity: '0.4' }} />
                </StackCraftNestedRouteLink>
              ))}
            </CardContent>
          </Card>
        ) : null}

        {/* Services Card -- full width, outside the grid */}
        <Card variant="outlined" style={{ overflow: 'visible' }}>
          <CardHeader
            title={`Services (${services.length})`}
            subheader={buildServicesSummary()}
            avatar={<Icon icon={icons.code} />}
            action={
              <StackCraftNestedRouteLink
                href="/stacks/:stackName/services"
                params={{ stackName }}
                style={{ color: 'inherit' }}
              >
                <Icon icon={icons.chevronRight} size="small" style={{ cursor: 'pointer' }} />
              </StackCraftNestedRouteLink>
            }
          />
          {services.length > 0 ? (
            <CardContent style={{ padding: '0' }}>
              {services.map((svc, index) => (
                <ServiceRow service={svc} stackName={stackName} showTopBorder={index > 0} />
              ))}
            </CardContent>
          ) : null}
          <CardActions>
            <StackCraftNestedRouteLink
              href="/stacks/:stackName/services"
              params={{ stackName }}
              style={{ textDecoration: 'none' }}
            >
              <Button variant="text" size="small">
                View All
              </Button>
            </StackCraftNestedRouteLink>
            <StackCraftNestedRouteLink
              href="/stacks/:stackName/services/wizard"
              params={{ stackName }}
              style={{ textDecoration: 'none' }}
            >
              <Button variant="text" size="small" startIcon={<Icon icon={icons.plus} size="small" />}>
                Create
              </Button>
            </StackCraftNestedRouteLink>
          </CardActions>
        </Card>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))',
            gap: '16px',
          }}
        >
          {/* Prerequisites Card */}
          <Card variant="outlined">
            <CardHeader
              title={`Prerequisites (${prereqs.length})`}
              subheader={buildPrereqsSummary()}
              avatar={<Icon icon={icons.check} />}
              action={
                <StackCraftNestedRouteLink
                  href="/stacks/:stackName/prerequisites"
                  params={{ stackName }}
                  style={{ color: 'inherit' }}
                >
                  <Icon icon={icons.chevronRight} size="small" style={{ cursor: 'pointer' }} />
                </StackCraftNestedRouteLink>
              }
            />
            {prereqs.length > 0 ? (
              <CardContent>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  {prereqs.slice(0, 5).map((prereq) => {
                    const status = checkResultMap.get(prereq.id)?.status ?? 'unchecked'
                    return (
                      <Chip variant="outlined" size="small" color={prereqStatusColor[status]}>
                        {prereq.name}
                      </Chip>
                    )
                  })}
                  {prereqs.length > 5 ? (
                    <span
                      style={{
                        fontSize: cssVariableTheme.typography.fontSize.sm,
                        opacity: '0.6',
                        alignSelf: 'center',
                      }}
                    >
                      +{prereqs.length - 5} more
                    </span>
                  ) : null}
                </div>
              </CardContent>
            ) : null}
            <CardActions>
              <StackCraftNestedRouteLink
                href="/stacks/:stackName/prerequisites"
                params={{ stackName }}
                style={{ textDecoration: 'none' }}
              >
                <Button variant="text" size="small">
                  View All
                </Button>
              </StackCraftNestedRouteLink>
            </CardActions>
          </Card>

          {/* Repositories Card */}
          <Card variant="outlined">
            <CardHeader
              title={`Repositories (${repos.length})`}
              subheader={repos.length > 0 ? `${repos.length} configured` : 'No repositories yet'}
              avatar={<Icon icon={icons.link} />}
              action={
                <StackCraftNestedRouteLink
                  href="/stacks/:stackName/repositories"
                  params={{ stackName }}
                  style={{ color: 'inherit' }}
                >
                  <Icon icon={icons.chevronRight} size="small" style={{ cursor: 'pointer' }} />
                </StackCraftNestedRouteLink>
              }
            />
            {repos.length > 0 ? (
              <CardContent>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  {repos.slice(0, 5).map((repo) => (
                    <Chip variant="outlined" size="small">
                      {repo.displayName}
                    </Chip>
                  ))}
                  {repos.length > 5 ? (
                    <span
                      style={{
                        fontSize: cssVariableTheme.typography.fontSize.sm,
                        opacity: '0.6',
                        alignSelf: 'center',
                      }}
                    >
                      +{repos.length - 5} more
                    </span>
                  ) : null}
                </div>
              </CardContent>
            ) : null}
            <CardActions>
              <StackCraftNestedRouteLink
                href="/stacks/:stackName/repositories"
                params={{ stackName }}
                style={{ textDecoration: 'none' }}
              >
                <Button variant="text" size="small">
                  View All
                </Button>
              </StackCraftNestedRouteLink>
              <StackCraftNestedRouteLink
                href="/stacks/:stackName/repositories/create"
                params={{ stackName }}
                style={{ textDecoration: 'none' }}
              >
                <Button variant="text" size="small" startIcon={<Icon icon={icons.plus} size="small" />}>
                  Add
                </Button>
              </StackCraftNestedRouteLink>
            </CardActions>
          </Card>
        </div>
      </PageContainer>
    )
  },
})
