import { createComponent, Shade } from '@furystack/shades'
import {
  Button,
  Chip,
  cssVariableTheme,
  Icon,
  icons,
  MarkdownDisplay,
  Paper,
} from '@furystack/shades-common-components'
import type { ServiceView } from 'common'
import type { GitHubRepository, Prerequisite } from 'common'

import { StackCraftNestedRouteLink } from '../../../components/app-routes.js'
import { PrerequisiteList } from '../../../components/prerequisite-list.js'
import { ServicePipelineStepper } from '../../../components/service-pipeline-stepper.js'

/* ============================================
 * Overview Tab
 * ============================================ */

type OverviewTabProps = {
  service: ServiceView
  linkedRepo: GitHubRepository | undefined
  fullCwd: string | null
  servicePrereqs: Prerequisite[]
  prereqSatisfiedCount: number
  prereqFailedCount: number
  actionInProgress: string | null
  onAction: (apiAction: string) => void
  onViewLogs: () => void
}

export const OverviewTab = Shade<OverviewTabProps>({
  customElementName: 'shade-service-overview-tab',
  render: ({ props }) => {
    const { service, linkedRepo, fullCwd, servicePrereqs, prereqSatisfiedCount, prereqFailedCount } = props

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {service.description ? (
          <Paper>
            <MarkdownDisplay content={service.description} />
          </Paper>
        ) : null}

        {/* Pipeline stepper */}
        <Paper>
          <h3 style={{ margin: '0 0 8px 0' }}>Pipeline</h3>
          <ServicePipelineStepper service={service} onAction={props.onAction} onViewLogs={props.onViewLogs} />
        </Paper>

        {/* Service info */}
        <Paper>
          <h3 style={{ margin: '0 0 12px 0' }}>Service Info</h3>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'minmax(120px, auto) 1fr auto',
              gap: `8px ${cssVariableTheme.spacing.md}`,
              fontSize: cssVariableTheme.typography.fontSize.md,
              alignItems: 'center',
            }}
          >
            {linkedRepo ? (
              <div style={{ display: 'contents' }}>
                <strong>Repository</strong>
                <span>
                  <StackCraftNestedRouteLink
                    href="/stacks/:stackName/repositories/:repositoryId"
                    params={{ stackName: service.stackName, repositoryId: linkedRepo.id }}
                    style={{ color: 'inherit' }}
                  >
                    {linkedRepo.displayName}
                  </StackCraftNestedRouteLink>
                </span>
                <span>
                  {linkedRepo.url ? (
                    <a href={linkedRepo.url} target="_blank" rel="noopener noreferrer" style={{ color: 'inherit' }}>
                      <Button
                        variant="outlined"
                        size="small"
                        startIcon={<Icon icon={icons.externalLink} size="small" />}
                      >
                        Open
                      </Button>
                    </a>
                  ) : null}
                </span>
              </div>
            ) : null}
            <strong>Working Directory</strong>
            <span style={{ fontFamily: 'monospace', fontSize: cssVariableTheme.typography.fontSize.sm }}>
              {fullCwd ?? '(loading…)'}
            </span>
            {fullCwd ? (
              <span style={{ display: 'flex', gap: '4px' }}>
                <a href={`cursor://file/${fullCwd}`} style={{ color: 'inherit' }}>
                  <Button variant="outlined" size="small" title="Open in Cursor">
                    Cursor
                  </Button>
                </a>
                <a href={`vscode://file/${fullCwd}`} style={{ color: 'inherit' }}>
                  <Button variant="outlined" size="small" title="Open in VS Code">
                    VS Code
                  </Button>
                </a>
              </span>
            ) : (
              <span />
            )}
          </div>
        </Paper>

        {/* Prerequisites */}
        {servicePrereqs.length > 0 ? (
          <Paper>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
              <h3 style={{ margin: '0' }}>Prerequisites</h3>
              {prereqSatisfiedCount === servicePrereqs.length ? (
                <Chip variant="outlined" color="success" size="small">
                  ✓ All satisfied
                </Chip>
              ) : prereqFailedCount > 0 ? (
                <Chip variant="outlined" color="error" size="small">
                  {prereqSatisfiedCount}/{servicePrereqs.length} satisfied
                </Chip>
              ) : (
                <Chip variant="outlined" color="secondary" size="small">
                  {prereqSatisfiedCount}/{servicePrereqs.length} satisfied
                </Chip>
              )}
            </div>
            <PrerequisiteList prerequisites={servicePrereqs} />
          </Paper>
        ) : null}
      </div>
    )
  },
})
