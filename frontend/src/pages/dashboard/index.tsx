import { useCollectionSync } from '@furystack/entity-sync-client'
import { createComponent, Shade } from '@furystack/shades'

import {
  Button,
  Chip,
  cssVariableTheme,
  Icon,
  icons,
  Loader,
  MarkdownDisplay,
  PageContainer,
  PageHeader,
  Paper,
} from '@furystack/shades-common-components'
import type { ServiceView } from 'common'
import {
  GitHubRepository,
  Prerequisite,
  ServiceConfig,
  ServiceDefinition,
  ServiceStatus,
  StackDefinition,
} from 'common'
import { StackCraftNestedRouteLink } from '../../components/app-routes.js'
import { RunStatusChip } from '../../components/status-chips.js'

type DashboardProps = {
  stackName?: string
}

export const Dashboard = Shade<DashboardProps>({
  customElementName: 'shade-dashboard',
  render: (options) => {
    const { props } = options

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
              <div style={{ display: 'flex', gap: '8px' }}>
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
          {stacks.map((stack) => (
            <StackCraftNestedRouteLink
              href="/stacks/:stackName"
              params={{ stackName: stack.name }}
              style={{ textDecoration: 'none', color: 'inherit' }}
            >
              <Paper style={{ cursor: 'pointer' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <Icon icon={icons.layers} />
                    <h3 style={{ margin: '0', fontSize: cssVariableTheme.typography.fontSize.lg }}>
                      {stack.displayName}
                    </h3>
                  </div>
                  <Icon icon={icons.chevronRight} size="small" />
                </div>
                {stack.description ? (
                  <div
                    style={{
                      marginTop: '8px',
                      fontSize: cssVariableTheme.typography.fontSize.md,
                      color: cssVariableTheme.text.secondary,
                    }}
                  >
                    <MarkdownDisplay content={stack.description} />
                  </div>
                ) : null}
              </Paper>
            </StackCraftNestedRouteLink>
          ))}
        </PageContainer>
      )
    }

    const currentStack = stacks.find((s) => s.name === props.stackName)

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
    }))

    const reposState = useCollectionSync(options, GitHubRepository, {
      filter: { stackName: { $eq: props.stackName } },
    })
    const repos = reposState.status === 'synced' || reposState.status === 'cached' ? reposState.data.entries : []

    const prereqsState = useCollectionSync(options, Prerequisite, {
      filter: { stackName: { $eq: props.stackName } },
    })
    const prereqs =
      prereqsState.status === 'synced' || prereqsState.status === 'cached' ? prereqsState.data.entries : []

    const runningCount = services.filter((s) => s.runStatus === 'running').length
    const stoppedCount = services.filter((s) => s.runStatus === 'stopped').length

    return (
      <PageContainer>
        <PageHeader
          icon={<Icon icon={icons.layers} />}
          title={currentStack?.displayName ?? props.stackName}
          actions={
            <div style={{ display: 'flex', gap: '8px' }}>
              <StackCraftNestedRouteLink href="/stacks/:stackName/export" params={{ stackName: props.stackName }}>
                <Button variant="outlined" size="small" startIcon={<Icon icon={icons.download} size="small" />}>
                  Export
                </Button>
              </StackCraftNestedRouteLink>
              <StackCraftNestedRouteLink href="/stacks/:stackName/edit" params={{ stackName: props.stackName }}>
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
          <p
            style={{
              margin: '0 0 8px',
              color: cssVariableTheme.text.secondary,
              fontSize: cssVariableTheme.typography.fontSize.md,
            }}
          >
            Getting started? Add repositories, then define prerequisites, create services, and run setup.
          </p>
        ) : null}

        <StackCraftNestedRouteLink
          href="/stacks/:stackName/services"
          params={{ stackName: props.stackName }}
          style={{ textDecoration: 'none', color: 'inherit' }}
        >
          <Paper style={{ cursor: 'pointer' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <Icon icon={icons.code} />
                <h3 style={{ margin: '0', fontSize: cssVariableTheme.typography.fontSize.lg }}>Services</h3>
                <Chip variant="outlined" size="small">
                  {services.length}
                </Chip>
              </div>
              <Icon icon={icons.chevronRight} size="small" />
            </div>
            {services.length > 0 ? (
              <div style={{ display: 'flex', gap: '8px', marginTop: '12px', flexWrap: 'wrap' }}>
                {runningCount > 0 ? (
                  <Chip variant="outlined" size="small" color="success">
                    {runningCount} running
                  </Chip>
                ) : null}
                {stoppedCount > 0 ? (
                  <Chip variant="outlined" size="small" color="secondary">
                    {stoppedCount} stopped
                  </Chip>
                ) : null}
                {services.slice(0, 5).map((svc) => (
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      fontSize: cssVariableTheme.typography.fontSize.sm,
                      padding: '2px 8px',
                      borderRadius: '4px',
                      border: `1px solid ${cssVariableTheme.divider}`,
                    }}
                  >
                    <RunStatusChip status={svc.runStatus} />
                    <span>{svc.displayName}</span>
                  </div>
                ))}
                {services.length > 5 ? (
                  <span
                    style={{ fontSize: cssVariableTheme.typography.fontSize.sm, opacity: '0.6', alignSelf: 'center' }}
                  >
                    +{services.length - 5} more
                  </span>
                ) : null}
              </div>
            ) : (
              <p style={{ margin: '8px 0 0', opacity: '0.5', fontSize: cssVariableTheme.typography.fontSize.md }}>
                No services yet.
              </p>
            )}
          </Paper>
        </StackCraftNestedRouteLink>

        <StackCraftNestedRouteLink
          href="/stacks/:stackName/repositories"
          params={{ stackName: props.stackName }}
          style={{ textDecoration: 'none', color: 'inherit' }}
        >
          <Paper style={{ cursor: 'pointer' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <Icon icon={icons.link} />
                <h3 style={{ margin: '0', fontSize: cssVariableTheme.typography.fontSize.lg }}>Repositories</h3>
                <Chip variant="outlined" size="small">
                  {repos.length}
                </Chip>
              </div>
              <Icon icon={icons.chevronRight} size="small" />
            </div>
            {repos.length > 0 ? (
              <div style={{ display: 'flex', gap: '8px', marginTop: '12px', flexWrap: 'wrap' }}>
                {repos.slice(0, 5).map((repo) => (
                  <Chip variant="outlined" size="small">
                    {repo.displayName}
                  </Chip>
                ))}
                {repos.length > 5 ? (
                  <span
                    style={{ fontSize: cssVariableTheme.typography.fontSize.sm, opacity: '0.6', alignSelf: 'center' }}
                  >
                    +{repos.length - 5} more
                  </span>
                ) : null}
              </div>
            ) : (
              <p style={{ margin: '8px 0 0', opacity: '0.5', fontSize: cssVariableTheme.typography.fontSize.md }}>
                No repositories yet.
              </p>
            )}
          </Paper>
        </StackCraftNestedRouteLink>

        <StackCraftNestedRouteLink
          href="/stacks/:stackName/prerequisites"
          params={{ stackName: props.stackName }}
          style={{ textDecoration: 'none', color: 'inherit' }}
        >
          <Paper style={{ cursor: 'pointer' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <Icon icon={icons.check} />
                <h3 style={{ margin: '0', fontSize: cssVariableTheme.typography.fontSize.lg }}>Prerequisites</h3>
                <Chip variant="outlined" size="small">
                  {prereqs.length}
                </Chip>
              </div>
              <Icon icon={icons.chevronRight} size="small" />
            </div>
            {prereqs.length > 0 ? (
              <div style={{ display: 'flex', gap: '8px', marginTop: '12px', flexWrap: 'wrap' }}>
                {prereqs.slice(0, 5).map((prereq) => (
                  <Chip variant="outlined" size="small">
                    {prereq.name}
                  </Chip>
                ))}
                {prereqs.length > 5 ? (
                  <span
                    style={{ fontSize: cssVariableTheme.typography.fontSize.sm, opacity: '0.6', alignSelf: 'center' }}
                  >
                    +{prereqs.length - 5} more
                  </span>
                ) : null}
              </div>
            ) : (
              <p style={{ margin: '8px 0 0', opacity: '0.5', fontSize: cssVariableTheme.typography.fontSize.md }}>
                No prerequisites yet.
              </p>
            )}
          </Paper>
        </StackCraftNestedRouteLink>
      </PageContainer>
    )
  },
})
