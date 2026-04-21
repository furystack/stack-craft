import { createComponent, Shade } from '@furystack/shades'

import type { Palette } from '@furystack/shades-common-components'
import { Badge, Button, cssVariableTheme, Icon, icons, NotyService } from '@furystack/shades-common-components'
import type { RunStatus, ServiceView } from 'common'

import { StackCraftNestedRouteLink } from '../../components/app-routes.js'
import { BranchSelector } from '../../components/branch-selector.js'
import { ServicesApiClient } from '../../services/api-clients/services-api-client.js'
import { getPrimaryAction } from '../../utils/service-pipeline.js'

export const runStatusPaletteKey: Record<RunStatus, keyof Palette> = {
  stopped: 'secondary',
  starting: 'warning',
  running: 'success',
  stopping: 'warning',
  error: 'error',
}

type ServiceRowProps = {
  service: ServiceView
  stackName: string
  showTopBorder: boolean
}

export const ServiceRow = Shade<ServiceRowProps>({
  customElementName: 'dashboard-service-row',
  render: ({ props, injector }) => {
    const { service: svc, stackName, showTopBorder } = props
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

    const primary = getPrimaryAction(svc)

    return (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '6px 16px',
          borderTop: showTopBorder ? `1px solid ${cssVariableTheme.divider}` : undefined,
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
            cloneStatus={svc.cloneStatus}
            upstreamStatus={svc.upstreamStatus}
            lastPullError={svc.lastPullError}
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
              startIcon={primary.icon ?? <Icon icon={icons.play} size="small" />}
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
  },
})
