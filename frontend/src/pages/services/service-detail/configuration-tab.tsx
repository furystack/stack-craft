import { createComponent, Shade } from '@furystack/shades'
import { Button, Chip, cssVariableTheme, Icon, icons, Paper } from '@furystack/shades-common-components'
import type { ServiceView } from 'common'
import type { GitHubRepository, Prerequisite, ServiceDefinition, StackConfig } from 'common'

import { ServiceForm } from '../../../components/entity-forms/service-form/index.js'
import { ServiceEnvOverrides } from '../../../components/service-env-overrides.js'

/* ============================================
 * Configuration Tab
 * ============================================ */

type ConfigurationTabProps = {
  service: ServiceView
  repos: GitHubRepository[]
  allPrereqs: Prerequisite[]
  otherServices: ServiceDefinition[]
  servicePrereqs: Prerequisite[]
  stackConfig: StackConfig | undefined
  actionInProgress: string | null
  onSave: (data: Partial<ServiceView>) => void
  onCancel: () => void
  onCreatePrerequisite: (data: Partial<Prerequisite>) => Promise<string>
  onCreateRepository: (data: Partial<GitHubRepository>) => Promise<string>
  onApplyFiles: (relativePath?: string) => Promise<void>
}

export const ConfigurationTab = Shade<ConfigurationTabProps>({
  customElementName: 'shade-service-config-tab',
  render: ({ props }) => {
    const { service, repos, allPrereqs, otherServices, servicePrereqs, stackConfig, actionInProgress } = props

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {/* Edit form */}
        <Paper>
          <h3 style={{ margin: '0 0 12px 0' }}>Edit Service</h3>
          <ServiceForm
            mode="edit"
            stackName={service.stackName}
            repositories={repos}
            prerequisites={allPrereqs}
            otherServices={otherServices}
            initial={service}
            onSubmit={props.onSave}
            onCreatePrerequisite={props.onCreatePrerequisite}
            onCreateRepository={props.onCreateRepository}
            onCancel={props.onCancel}
          />
        </Paper>

        {/* Shared files */}
        {service.files && service.files.length > 0 ? (
          <Paper>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
              <h3 style={{ margin: '0' }}>Shared Files</h3>
              <Chip variant="outlined" size="small">
                {service.files.length} file(s)
              </Chip>
              <Button
                variant="outlined"
                size="small"
                loading={actionInProgress === 'apply-files-all'}
                disabled={!!actionInProgress}
                onclick={() => void props.onApplyFiles()}
                startIcon={<Icon icon={icons.download} size="small" />}
              >
                Apply All
              </Button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {service.files.map((file) => {
                const isOverridden = (service.localFiles ?? []).some((lf) => lf.relativePath === file.relativePath)
                return (
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '12px',
                      padding: '8px 12px',
                      borderRadius: '8px',
                      border: `1px solid ${cssVariableTheme.divider}`,
                      fontFamily: 'monospace',
                      fontSize: cssVariableTheme.typography.fontSize.sm,
                      opacity: isOverridden ? '0.5' : '1',
                    }}
                  >
                    <span style={{ flex: '1', overflow: 'hidden', textOverflow: 'ellipsis' }}>{file.relativePath}</span>
                    {isOverridden ? (
                      <Chip variant="outlined" size="small">
                        Overridden by local
                      </Chip>
                    ) : null}
                    <Button
                      variant="outlined"
                      size="small"
                      loading={actionInProgress === `apply-file-${file.relativePath}`}
                      disabled={!!actionInProgress}
                      onclick={() => void props.onApplyFiles(file.relativePath)}
                      startIcon={<Icon icon={icons.download} size="small" />}
                    >
                      Apply
                    </Button>
                  </div>
                )
              })}
            </div>
          </Paper>
        ) : null}

        {/* Local files */}
        {service.localFiles && service.localFiles.length > 0 ? (
          <Paper>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
              <h3 style={{ margin: '0' }}>Local Files</h3>
              <Icon icon={icons.lock} size="small" title="Encrypted at rest, never exported" />
              <Chip variant="outlined" size="small">
                {service.localFiles.length} file(s)
              </Chip>
            </div>
            <p style={{ margin: '0 0 8px 0', opacity: '0.6', fontSize: cssVariableTheme.typography.fontSize.sm }}>
              Per-installation secret files. Encrypted at rest and never included in stack exports.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {service.localFiles.map((file) => (
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    padding: '8px 12px',
                    borderRadius: '8px',
                    border: `1px solid ${cssVariableTheme.palette.warning.main}`,
                    fontFamily: 'monospace',
                    fontSize: cssVariableTheme.typography.fontSize.sm,
                  }}
                >
                  <Icon icon={icons.lock} size="small" />
                  <span style={{ flex: '1', overflow: 'hidden', textOverflow: 'ellipsis' }}>{file.relativePath}</span>
                  <Button
                    variant="outlined"
                    size="small"
                    loading={actionInProgress === `apply-file-${file.relativePath}`}
                    disabled={!!actionInProgress}
                    onclick={() => void props.onApplyFiles(file.relativePath)}
                    startIcon={<Icon icon={icons.download} size="small" />}
                  >
                    Apply
                  </Button>
                </div>
              ))}
            </div>
          </Paper>
        ) : null}

        {/* Environment variable overrides */}
        {servicePrereqs.some((p) => p.type === 'env-variable') ? (
          <ServiceEnvOverrides
            service={service}
            envPrereqs={servicePrereqs.filter((p) => p.type === 'env-variable')}
            stackEnvVars={stackConfig?.environmentVariables ?? {}}
          />
        ) : null}
      </div>
    )
  },
})
