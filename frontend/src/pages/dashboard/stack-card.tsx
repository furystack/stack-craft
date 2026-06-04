import { createComponent, Shade } from '@furystack/shades'

import type { Palette } from '@furystack/shades-common-components'
import {
  Card,
  CardActions,
  CardContent,
  Chip,
  cssVariableTheme,
  Icon,
  icons,
  MarkdownDisplay,
} from '@furystack/shades-common-components'
import type { PrerequisiteCheckStatus, ServiceView, StackDefinition } from 'common'

import { StackCraftNestedRouteLink } from '../../components/app-routes.js'
import { StackCardBulkActions } from './stack-card-bulk-actions.js'

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
  render: ({ props }) => {
    const { stack, stackServices, stackPrereqs, checkResultMap } = props

    const running = stackServices.filter((s) => s.runStatus === 'running').length
    const stopped = stackServices.filter((s) => s.runStatus === 'stopped').length
    const errored = stackServices.filter((s) => s.runStatus === 'error').length
    const starting = stackServices.filter((s) => s.runStatus === 'starting').length
    const stopping = stackServices.filter((s) => s.runStatus === 'stopping').length

    const satisfied = stackPrereqs.filter((p) => checkResultMap.get(p.id)?.status === 'satisfied').length
    const failed = stackPrereqs.filter((p) => checkResultMap.get(p.id)?.status === 'failed').length
    const unchecked = stackPrereqs.length - satisfied - failed

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
              <StackCardBulkActions stackServices={stackServices} />
            </CardActions>
          ) : null}
        </Card>
      </StackCraftNestedRouteLink>
    )
  },
})
