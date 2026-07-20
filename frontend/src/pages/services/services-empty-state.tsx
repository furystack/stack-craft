import { createComponent, Shade } from '@furystack/shades'

import { Card, CardContent, CardHeader, cssVariableTheme, Icon, icons } from '@furystack/shades-common-components'

import { StackCraftNestedRouteLink } from '../../components/app-routes.js'

type ServicesEmptyStateProps = {
  stackName: string
  repoCount: number
  prereqCount: number
}

export const ServicesEmptyState = Shade<ServicesEmptyStateProps>({
  customElementName: 'shade-services-empty-state',
  render: ({ props }) => {
    const { stackName, repoCount, prereqCount } = props

    const steps = [
      {
        step: 1,
        title: 'Add Repositories',
        description: 'Link GitHub repositories to clone',
        isComplete: repoCount > 0,
        summary: repoCount > 0 ? `${repoCount} repositor${repoCount === 1 ? 'y' : 'ies'} configured` : undefined,
        href: '/stacks/:stackName/repositories' as const,
        icon: icons.link,
      },
      {
        step: 2,
        title: 'Configure Prerequisites',
        description: 'Set up environment requirements',
        isComplete: prereqCount > 0,
        summary: prereqCount > 0 ? `${prereqCount} prerequisite${prereqCount === 1 ? '' : 's'} configured` : undefined,
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
    ] as const

    return (
      <Card variant="outlined">
        <CardHeader
          title="Getting Started"
          subheader="Set up your stack step by step"
          avatar={<Icon icon={icons.layers} />}
        />
        <CardContent style={{ display: 'flex', flexDirection: 'column', gap: '0' }}>
          {steps.map((item, index) => (
            <StackCraftNestedRouteLink
              path={item.href}
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
    )
  },
})
