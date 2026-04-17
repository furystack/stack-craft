import { createComponent, Shade } from '@furystack/shades'
import { Paper } from '@furystack/shades-common-components'
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
  onSave: (data: Partial<ServiceView>) => void
  onCancel: () => void
  onCreatePrerequisite: (data: Partial<Prerequisite>) => Promise<string>
  onCreateRepository: (data: Partial<GitHubRepository>) => Promise<string>
}

export const ConfigurationTab = Shade<ConfigurationTabProps>({
  customElementName: 'shade-service-config-tab',
  render: ({ props }) => {
    const { service, repos, allPrereqs, otherServices, servicePrereqs, stackConfig } = props

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

        {/* Environment variable overrides */}
        <ServiceEnvOverrides
          service={service}
          envPrereqs={servicePrereqs.filter((p) => p.type === 'env-variable')}
          stackEnvVars={stackConfig?.environmentVariables ?? {}}
        />
      </div>
    )
  },
})
