import { createComponent, Shade } from '@furystack/shades'

import type { Palette } from '@furystack/shades-common-components'
import {
  Button,
  Card,
  CardActions,
  CardContent,
  Chip,
  cssVariableTheme,
  Icon,
  icons,
  MarkdownDisplay,
  NotyService,
} from '@furystack/shades-common-components'
import type { PrerequisiteCheckStatus, ServiceView, StackDefinition } from 'common'

import { StackCraftNestedRouteLink } from '../../components/app-routes.js'
import { ServicesApiClient } from '../../services/api-clients/services-api-client.js'
import { isServiceReady } from '../../utils/is-service-ready.js'

type StackCardProps = {
  stack: StackDefinition
  stackServices: ServiceView[]
  stackPrereqs: Array<{ id: string }>
  checkResultMap: Map<string, { status: PrerequisiteCheckStatus }>
}

const prereqStatusColor: Record<PrerequisiteCheckStatus, keyof Palette> = {
  unchecked: 'secondary',
  satisfied: 'success',
  failed: 'error',
  checking: 'warning',
}

export const StackCard = Shade<StackCardProps>({
  customElementName: 'stack-card',
  render: ({ props, injector, useState }) => {
    const { stack, stackServices, stackPrereqs, checkResultMap } = props

    const running = stackServices.filter((s) => s.runStatus === 'running').length
    const stopped = stackServices.filter((s) => s.runStatus === 'stopped').length
    const errored = stackServices.filter((s) => s.runStatus === 'error').length
    const starting = stackServices.filter((s) => s.runStatus === 'starting').length
    const stopping = stackServices.filter((s) => s.runStatus === 'stopping').length
    const clonedCount = stackServices.filter((s) => s.repositoryId && s.cloneStatus === 'cloned').length

    const satisfied = stackPrereqs.filter((p) => checkResultMap.get(p.id)?.status === 'satisfied').length
    const failed = stackPrereqs.filter((p) => checkResultMap.get(p.id)?.status === 'failed').length
    const unchecked = stackPrereqs.length - satisfied - failed

    const [isStartingAll, setIsStartingAll] = useState('isStartingAll', false)
    const [isStoppingAll, setIsStoppingAll] = useState('isStoppingAll', false)
    const [isUpdatingAll, setIsUpdatingAll] = useState('isUpdatingAll', false)

    const api = injector.get(ServicesApiClient)
    const noty = injector.get(NotyService)

    const triggerStartAll = async () => {
      setIsStartingAll(true)
      const failures: string[] = []
      for (const svc of stackServices) {
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
      for (const svc of stackServices) {
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

    const triggerUpdateAll = async () => {
      setIsUpdatingAll(true)
      const failures: string[] = []
      for (const svc of stackServices) {
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

    const stopCardNav = (e: MouseEvent) => e.stopPropagation()

    return (
      <StackCraftNestedRouteLink
        path="/stacks/:stackName/services"
        params={{ stackName: stack.name }}
        style={{ textDecoration: 'none', color: 'inherit' }}
      >
        <Card variant="outlined" clickable style={{ height: '100%' }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: cssVariableTheme.spacing.md,
              padding: cssVariableTheme.spacing.md,
              flexWrap: 'wrap',
            }}
          >
            <Icon icon={icons.layers} style={{ flexShrink: '0' }} />
            <div
              style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', flex: '1', minWidth: '0' }}
            >
              <span
                style={{
                  fontSize: cssVariableTheme.typography.fontSize.lg,
                  fontWeight: cssVariableTheme.typography.fontWeight.semibold,
                }}
              >
                {stack.displayName}
              </span>
              {stackServices.length > 0 ? (
                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
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
                <Chip variant="outlined" size="small" color="secondary">
                  No services
                </Chip>
              )}
            </div>
            <Icon icon={icons.chevronRight} size="small" style={{ flexShrink: '0' }} />
          </div>
          <CardContent>
            {stackPrereqs.length > 0 ? (
              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                {satisfied > 0 ? (
                  <Chip variant="outlined" size="small" color={prereqStatusColor.satisfied}>
                    {satisfied} satisfied
                  </Chip>
                ) : null}
                {failed > 0 ? (
                  <Chip variant="outlined" size="small" color={prereqStatusColor.failed}>
                    {failed} failed
                  </Chip>
                ) : null}
                {unchecked > 0 ? (
                  <Chip variant="outlined" size="small" color={prereqStatusColor.unchecked}>
                    {unchecked} unchecked
                  </Chip>
                ) : null}
              </div>
            ) : null}
            {stack.description ? (
              <div
                style={{
                  marginTop: stackPrereqs.length > 0 ? '8px' : '0',
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
          {stackServices.length > 0 ? (
            <CardActions onclick={stopCardNav}>
              <Button
                variant="text"
                size="small"
                color="success"
                disabled={stopped === 0 && errored === 0}
                loading={isStartingAll}
                onclick={() => void triggerStartAll()}
                startIcon={<Icon icon={icons.play} size="small" />}
              >
                Start All
              </Button>
              <Button
                variant="text"
                size="small"
                disabled={running === 0}
                loading={isStoppingAll}
                onclick={() => void triggerStopAll()}
                startIcon={<Icon icon={icons.stopCircle} size="small" />}
              >
                Stop All
              </Button>
              <Button
                variant="text"
                size="small"
                disabled={clonedCount === 0}
                loading={isUpdatingAll}
                onclick={() => void triggerUpdateAll()}
                startIcon={<Icon icon={icons.download} size="small" />}
              >
                Update All
              </Button>
            </CardActions>
          ) : null}
        </Card>
      </StackCraftNestedRouteLink>
    )
  },
})
