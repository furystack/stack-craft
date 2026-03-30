import { useCollectionSync } from '@furystack/entity-sync-client'
import { createComponent, Shade } from '@furystack/shades'

import type { Palette } from '@furystack/shades-common-components'
import {
  Badge,
  Button,
  Card,
  CardActions,
  CardContent,
  CardHeader,
  Chip,
  cssVariableTheme,
  Icon,
  icons,
  Loader,
  MarkdownDisplay,
  NotyService,
  PageContainer,
  PageHeader,
  Paper,
} from '@furystack/shades-common-components'
import type { PrerequisiteCheckStatus, ServiceView } from 'common'
import {
  GitHubRepository,
  Prerequisite,
  PrerequisiteCheckResult,
  ServiceConfig,
  ServiceDefinition,
  ServiceGitStatus,
  ServiceStatus,
  StackDefinition,
} from 'common'

import type { RunStatus } from 'common'

import { StackCraftNestedRouteLink } from '../../components/app-routes.js'
import { BranchSelector } from '../../components/branch-selector.js'
import { ServicesApiClient } from '../../services/api-clients/services-api-client.js'
import { getPrimaryAction } from '../../utils/service-pipeline.js'

const runStatusPaletteKey: Record<RunStatus, keyof Palette> = {
  stopped: 'secondary',
  starting: 'warning',
  running: 'success',
  stopping: 'warning',
  error: 'error',
}

const prereqStatusColor: Record<PrerequisiteCheckStatus, keyof Palette> = {
  unchecked: 'secondary',
  checking: 'warning',
  satisfied: 'success',
  failed: 'error',
}

const isServiceReady = (svc: ServiceView): boolean => {
  const cloneOk = !svc.repositoryId || svc.cloneStatus === 'cloned'
  const installOk = !svc.installCommand || svc.installStatus === 'installed'
  const buildOk = !svc.buildCommand || svc.buildStatus === 'built'
  return cloneOk && installOk && buildOk
}

type DashboardProps = {
  stackName?: string
}

export const Dashboard = Shade<DashboardProps>({
  customElementName: 'shade-dashboard',
  render: (options) => {
    const { props, injector, useState } = options

    const stacksState = useCollectionSync(options, StackDefinition, {})
    const stacks = stacksState.status === 'synced' || stacksState.status === 'cached' ? stacksState.data.entries : []

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

    if (!props.stackName) {
      const allDefsState = useCollectionSync(options, ServiceDefinition, {})
      const allDefs =
        allDefsState.status === 'synced' || allDefsState.status === 'cached' ? allDefsState.data.entries : []

      const allStatusesState = useCollectionSync(options, ServiceStatus, {})
      const allStatuses =
        allStatusesState.status === 'synced' || allStatusesState.status === 'cached'
          ? allStatusesState.data.entries
          : []

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

      const allServices: ServiceView[] = allDefs.map((def) => ({
        serviceId: def.id,
        autoFetchEnabled: false,
        autoFetchIntervalMinutes: 60,
        autoRestartOnFetch: false,
        environmentVariableOverrides: {},
        localFiles: [],
        cloneStatus: 'not-cloned' as const,
        installStatus: 'not-installed' as const,
        buildStatus: 'not-built' as const,
        runStatus: 'stopped' as const,
        ...def,
        ...(allConfigMap.get(def.id) ?? {}),
        ...(allStatusMap.get(def.id) ?? {}),
        ...(allGitMap.get(def.id) ?? {}),
      }))

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

      const api = injector.getInstance(ServicesApiClient)
      const noty = injector.getInstance(NotyService)

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
                <StackCraftNestedRouteLink href="/stacks/create">
                  <Button variant="contained" size="small" startIcon={<Icon icon={icons.plus} size="small" />}>
                    Create Stack
                  </Button>
                </StackCraftNestedRouteLink>
                <StackCraftNestedRouteLink href="/stacks/import">
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
                  href="/stacks/:stackName"
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
    }

    const { stackName } = props
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

    const services: ServiceView[] = defs.map((def) => ({
      serviceId: def.id,
      autoFetchEnabled: false,
      autoFetchIntervalMinutes: 60,
      autoRestartOnFetch: false,
      environmentVariableOverrides: {},
      localFiles: [],
      cloneStatus: 'not-cloned' as const,
      installStatus: 'not-installed' as const,
      buildStatus: 'not-built' as const,
      runStatus: 'stopped' as const,
      ...def,
      ...(configMap.get(def.id) ?? {}),
      ...(statusMap.get(def.id) ?? {}),
      ...(gitStatusMap.get(def.id) ?? {}),
    }))

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

    const callServiceAction = (serviceId: string, action: string, actionLabel: string) => {
      void api
        .call({
          method: 'POST',
          action: `/services/:id/${action}` as '/services/:id/start',
          url: { id: serviceId },
        })
        .catch((error: unknown) => {
          noty.emit('onNotyAdded', {
            title: `${actionLabel} failed`,
            body: error instanceof Error ? error.message : `Failed to execute ${actionLabel}`,
            type: 'error',
          })
        })
    }

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
              {services.map((svc, index) => {
                const primary = getPrimaryAction(svc)
                return (
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '6px 16px',
                      borderTop: index > 0 ? `1px solid ${cssVariableTheme.divider}` : undefined,
                      gap: '8px',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: '0', flex: '1' }}>
                      <span
                        style={{
                          width: '8px',
                          height: '8px',
                          borderRadius: '50%',
                          backgroundColor: cssVariableTheme.palette[runStatusPaletteKey[svc.runStatus]].main,
                          flexShrink: '0',
                        }}
                        title={svc.runStatus}
                      />
                      <StackCraftNestedRouteLink
                        href="/stacks/:stackName/services/:serviceId"
                        params={{ stackName, serviceId: svc.id }}
                        style={{
                          textDecoration: 'none',
                          color: cssVariableTheme.text.primary,
                          fontSize: cssVariableTheme.typography.fontSize.sm,
                          fontWeight: '500',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {svc.displayName}
                      </StackCraftNestedRouteLink>
                    </div>
                    <div style={{ flexShrink: '0' }} onclick={(e: MouseEvent) => e.stopPropagation()}>
                      <BranchSelector
                        serviceId={svc.id}
                        currentBranch={svc.currentBranch}
                        isCloned={svc.cloneStatus === 'cloned'}
                      />
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '2px', flexShrink: '0' }}>
                      {primary.apiAction ? (
                        <Button
                          variant="text"
                          size="small"
                          color={primary.color === 'secondary' ? undefined : primary.color}
                          title={primary.label}
                          onclick={() => callServiceAction(svc.id, primary.apiAction.split('/').pop()!, primary.label)}
                          startIcon={
                            <Icon icon={icons[primary.icon as keyof typeof icons] ?? icons.play} size="small" />
                          }
                        />
                      ) : null}
                      {svc.runStatus === 'running' ? (
                        <Button
                          variant="text"
                          size="small"
                          color="warning"
                          title="Restart"
                          onclick={() => callServiceAction(svc.id, 'restart', 'Restart')}
                          startIcon={<Icon icon={icons.refresh} size="small" />}
                        />
                      ) : null}
                      {svc.repositoryId && svc.cloneStatus === 'cloned' ? (
                        <Badge count={svc.commitsBehind} color="primary">
                          <Button
                            variant="text"
                            size="small"
                            title="Update: pull, install, build, and restart if running"
                            onclick={() => callServiceAction(svc.id, 'update', 'Update')}
                            startIcon={<Icon icon={icons.download} size="small" />}
                          />
                        </Badge>
                      ) : null}
                    </div>
                  </div>
                )
              })}
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
