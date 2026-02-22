import { useCollectionSync } from '@furystack/entity-sync-client'
import { createComponent, NestedRouteLink, Shade } from '@furystack/shades'

import {
  Button,
  Chip,
  cssVariableTheme,
  Icon,
  icons,
  Loader,
  NotyService,
  PageContainer,
  PageHeader,
  Paper,
} from '@furystack/shades-common-components'
import type { Palette } from '@furystack/shades-common-components'
import type { CloneStatus, BuildStatus, InstallStatus, ServiceView } from 'common'
import { ServiceConfig, ServiceDefinition, ServiceStatus, StackDefinition } from 'common'

import { ServicesApiClient } from '../../services/api-clients/services-api-client.js'
import { StacksApiClient } from '../../services/api-clients/stacks-api-client.js'

type StackSetupProps = {
  stackName: string
}

type PhaseStatus = 'pending' | 'in-progress' | 'done' | 'failed' | 'skipped'

const getClonePhase = (svc: ServiceView): PhaseStatus => {
  if (!svc.repositoryId) return 'skipped'
  const map: Record<CloneStatus, PhaseStatus> = {
    'not-cloned': 'pending',
    cloning: 'in-progress',
    cloned: 'done',
    failed: 'failed',
  }
  return map[svc.cloneStatus] ?? 'pending'
}

const getInstallPhase = (svc: ServiceView): PhaseStatus => {
  if (!svc.installCommand) return 'skipped'
  const map: Record<InstallStatus, PhaseStatus> = {
    'not-installed': 'pending',
    installing: 'in-progress',
    installed: 'done',
    failed: 'failed',
  }
  return map[svc.installStatus] ?? 'pending'
}

const getBuildPhase = (svc: ServiceView): PhaseStatus => {
  if (!svc.buildCommand) return 'skipped'
  const map: Record<BuildStatus, PhaseStatus> = {
    'not-built': 'pending',
    building: 'in-progress',
    built: 'done',
    failed: 'failed',
  }
  return map[svc.buildStatus] ?? 'pending'
}

const phaseIcon: Record<PhaseStatus, string> = {
  pending: '·',
  'in-progress': '⏳',
  done: '✓',
  failed: '✗',
  skipped: '—',
}

const phaseColor: Record<PhaseStatus, keyof Palette | 'secondary'> = {
  pending: 'secondary',
  'in-progress': 'warning',
  done: 'success',
  failed: 'error',
  skipped: 'secondary',
}

const isServiceReady = (svc: ServiceView): boolean => {
  const clone = getClonePhase(svc)
  const install = getInstallPhase(svc)
  const build = getBuildPhase(svc)
  return (
    (clone === 'done' || clone === 'skipped') &&
    (install === 'done' || install === 'skipped') &&
    (build === 'done' || build === 'skipped')
  )
}

const isServiceInProgress = (svc: ServiceView): boolean => {
  return (
    getClonePhase(svc) === 'in-progress' ||
    getInstallPhase(svc) === 'in-progress' ||
    getBuildPhase(svc) === 'in-progress'
  )
}

const PhaseChip = Shade<{ status: PhaseStatus; label: string }>({
  shadowDomName: 'shade-phase-chip',
  render: ({ props }) => (
    <Chip variant="outlined" color={phaseColor[props.status]} size="small">
      {phaseIcon[props.status]} {props.label}
    </Chip>
  ),
})

export const StackSetup = Shade<StackSetupProps>({
  shadowDomName: 'shade-stack-setup',
  render: (options) => {
    const { props, injector, useState } = options

    const stacksState = useCollectionSync(options, StackDefinition, {
      filter: { name: { $eq: props.stackName } },
    })
    const stacks = stacksState.status === 'synced' || stacksState.status === 'cached' ? stacksState.data : []
    const currentStack = stacks[0]

    const servicesState = useCollectionSync(options, ServiceDefinition, {
      filter: { stackName: { $eq: props.stackName } },
    })
    const defs = servicesState.status === 'synced' || servicesState.status === 'cached' ? servicesState.data : []

    const statusesState = useCollectionSync(options, ServiceStatus, {})
    const statuses = statusesState.status === 'synced' || statusesState.status === 'cached' ? statusesState.data : []

    const configsState = useCollectionSync(options, ServiceConfig, {})
    const configs = configsState.status === 'synced' || configsState.status === 'cached' ? configsState.data : []

    const statusMap = new Map(statuses.map((s) => [s.serviceId, s]))
    const configMap = new Map(configs.map((c) => [c.serviceId, c]))

    const services: ServiceView[] = defs.map((def) => ({
      serviceId: def.id,
      autoFetchEnabled: false,
      autoFetchIntervalMinutes: 60,
      autoRestartOnFetch: false,
      cloneStatus: 'not-cloned' as const,
      installStatus: 'not-installed' as const,
      buildStatus: 'not-built' as const,
      runStatus: 'stopped' as const,
      ...def,
      ...(configMap.get(def.id) ?? {}),
      ...(statusMap.get(def.id) ?? {}),
    }))

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
          description="Clone repositories, install dependencies, and build services."
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
              <NestedRouteLink href={`/stacks/${props.stackName}`}>
                <Button
                  variant="outlined"
                  size="small"
                  startIcon={<Icon icon={icons.home} size="small" />}
                >
                  Go to Dashboard
                </Button>
              </NestedRouteLink>
            </div>
          }
        />

        <Paper>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr
                style={{
                  textAlign: 'left',
                  borderBottom: `1px solid ${cssVariableTheme.divider}`,
                  fontSize: '13px',
                  color: cssVariableTheme.text.secondary,
                }}
              >
                <th style={{ padding: '8px 12px' }}>Service</th>
                <th style={{ padding: '8px 12px', textAlign: 'center' }}>Clone</th>
                <th style={{ padding: '8px 12px', textAlign: 'center' }}>Install</th>
                <th style={{ padding: '8px 12px', textAlign: 'center' }}>Build</th>
                <th style={{ padding: '8px 12px', textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {services.map((svc) => {
                const clone = getClonePhase(svc)
                const install = getInstallPhase(svc)
                const build = getBuildPhase(svc)
                const ready = isServiceReady(svc)
                const inProgress = isServiceInProgress(svc) || setupTriggered.has(svc.id)

                return (
                  <tr
                    style={{
                      borderBottom: `1px solid ${cssVariableTheme.divider}`,
                    }}
                  >
                    <td style={{ padding: '10px 12px' }}>
                      <div style={{ fontWeight: 'bold', fontSize: '14px' }}>{svc.displayName}</div>
                      {svc.description ? (
                        <div style={{ fontSize: '12px', color: cssVariableTheme.text.secondary, marginTop: '2px' }}>
                          {svc.description}
                        </div>
                      ) : null}
                    </td>
                    <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                      <PhaseChip status={clone} label="Clone" />
                    </td>
                    <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                      <PhaseChip status={install} label="Install" />
                    </td>
                    <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                      <PhaseChip status={build} label="Build" />
                    </td>
                    <td style={{ padding: '10px 12px', textAlign: 'right' }}>
                      <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end' }}>
                        {ready ? (
                          <NestedRouteLink href={`/services/${svc.id}`}>
                            <Button
                              variant="outlined"
                              size="small"
                              color="success"
                              startIcon={<Icon icon={icons.checkCircle} size="small" />}
                            >
                              Ready
                            </Button>
                          </NestedRouteLink>
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
                        <NestedRouteLink href={`/services/${svc.id}/logs`}>
                          <Button
                            variant="outlined"
                            size="small"
                            startIcon={<Icon icon={icons.fileText} size="small" />}
                          >
                            Logs
                          </Button>
                        </NestedRouteLink>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          {services.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '32px', color: cssVariableTheme.text.secondary }}>
              No services in this stack.
            </div>
          ) : null}
        </Paper>
      </PageContainer>
    )
  },
})
