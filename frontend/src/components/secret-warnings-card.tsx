import { createComponent, Shade } from '@furystack/shades'
import { Card, CardContent, CardHeader, cssVariableTheme, Icon, icons } from '@furystack/shades-common-components'
import type { SecretWarning } from 'common'

import { StackCraftNestedRouteLink } from './app-routes.js'

type ServiceWarningGroup = {
  serviceId: string
  serviceName: string
  stackName: string
  warnings: SecretWarning[]
}

type SecretWarningsCardProps = {
  warningGroups: ServiceWarningGroup[]
}

export const SecretWarningsCard = Shade<SecretWarningsCardProps>({
  customElementName: 'secret-warnings-card',
  render: ({ props }) => {
    const { warningGroups } = props
    const totalWarnings = warningGroups.reduce((sum, g) => sum + g.warnings.length, 0)

    if (totalWarnings === 0) return <div style={{ display: 'none' }} />

    return (
      <Card variant="outlined">
        <CardHeader
          title={`Potential Secrets Detected (${totalWarnings})`}
          subheader="Hard-coded secrets were found in service definitions. Consider using environment variables or template interpolation instead."
          avatar={<Icon icon={icons.warning} style={{ color: cssVariableTheme.palette.warning.main }} />}
        />
        <CardContent style={{ paddingTop: '0' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {warningGroups.map((group) => (
              <div>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    marginBottom: '6px',
                    fontWeight: '500',
                    fontSize: cssVariableTheme.typography.fontSize.md,
                  }}
                >
                  <StackCraftNestedRouteLink
                    path="/stacks/:stackName/services/:serviceId"
                    params={{ stackName: group.stackName, serviceId: group.serviceId }}
                    style={{ color: cssVariableTheme.palette.primary.main, textDecoration: 'none' }}
                  >
                    {group.serviceName}
                  </StackCraftNestedRouteLink>
                  <span
                    style={{
                      fontSize: cssVariableTheme.typography.fontSize.sm,
                      color: cssVariableTheme.text.secondary,
                    }}
                  >
                    ({group.warnings.length} warning{group.warnings.length !== 1 ? 's' : ''})
                  </span>
                </div>
                {group.warnings.map((w) => (
                  <div
                    style={{
                      fontFamily: 'monospace',
                      fontSize: '12px',
                      padding: '6px 8px',
                      borderRadius: '4px',
                      background: 'rgba(0,0,0,0.1)',
                      marginBottom: '4px',
                      marginLeft: '12px',
                    }}
                  >
                    <strong>{w.source}</strong> — {w.pattern}
                    <br />
                    <span style={{ opacity: '0.7' }}>{w.snippet}</span>
                    {w.suggestion ? (
                      <span>
                        <br />
                        <em style={{ opacity: '0.8' }}>{w.suggestion}</em>
                      </span>
                    ) : null}
                  </div>
                ))}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    )
  },
})
