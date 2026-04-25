import { useCollectionSync } from '../../../services/entity-sync.js'
import { createComponent, Shade } from '@furystack/shades'
import { cssVariableTheme, NotyService, Paper } from '@furystack/shades-common-components'
import type { GitHubRepository, Prerequisite, ServiceView } from 'common'
import { GitHubRepository as GitHubRepositoryModel, Prerequisite as PrerequisiteModel, ServiceDefinition } from 'common'

import { stackCraftNavigate } from '../../../components/app-routes.js'
import { ServiceForm } from '../../../components/entity-forms/service-form/index.js'
import { GitHubReposApiClient } from '../../../services/api-clients/github-repos-api-client.js'
import { PrerequisitesApiClient } from '../../../services/api-clients/prerequisites-api-client.js'
import { ServicesApiClient } from '../../../services/api-clients/services-api-client.js'
import { SetupStep } from './setup-step.js'

type CreateServiceWizardProps = {
  stackName: string
}

type WizardState = {
  step: 0 | 1
  createdServiceId: string | null
  createdServiceName: string | null
  hasSetupWork: boolean
}

export const CreateServiceWizard = Shade<CreateServiceWizardProps>({
  customElementName: 'shade-create-service-wizard',
  render: (options) => {
    const { props, injector, useState } = options

    const [state, setState] = useState<WizardState>('wizardState', {
      step: 0,
      createdServiceId: null,
      createdServiceName: null,
      hasSetupWork: false,
    })

    const reposState = useCollectionSync(options, GitHubRepositoryModel, {
      filter: { stackName: { $eq: props.stackName } },
    })
    const repos = reposState.status === 'synced' || reposState.status === 'cached' ? reposState.data.entries : []

    const prereqsState = useCollectionSync(options, PrerequisiteModel, {
      filter: { stackName: { $eq: props.stackName } },
    })
    const prereqs: Prerequisite[] =
      prereqsState.status === 'synced' || prereqsState.status === 'cached' ? prereqsState.data.entries : []

    const servicesState = useCollectionSync(options, ServiceDefinition, {
      filter: { stackName: { $eq: props.stackName } },
    })
    const otherServices =
      servicesState.status === 'synced' || servicesState.status === 'cached' ? servicesState.data.entries : []

    const servicesApi = injector.get(ServicesApiClient)
    const reposApi = injector.get(GitHubReposApiClient)
    const prereqsApi = injector.get(PrerequisitesApiClient)
    const noty = injector.get(NotyService)

    const handleCreateService = async (data: Partial<ServiceView>) => {
      const serviceId = crypto.randomUUID()

      try {
        await servicesApi.call({
          method: 'POST',
          action: '/services',
          body: {
            id: serviceId,
            stackName: props.stackName,
            displayName: data.displayName!,
            description: data.description ?? '',
            workingDirectory: data.workingDirectory || undefined,
            runCommand: data.runCommand!,
            installCommand: data.installCommand || undefined,
            buildCommand: data.buildCommand || undefined,
            autoFetchEnabled: data.autoFetchEnabled ?? false,
            autoFetchIntervalMinutes: data.autoFetchIntervalMinutes ?? 60,
            autoRestartOnFetch: data.autoRestartOnFetch ?? false,
            repositoryId: data.repositoryId,
            prerequisiteIds: data.prerequisiteIds ?? [],
            prerequisiteServiceIds: data.prerequisiteServiceIds ?? [],
            files: data.files ?? [],
            localFiles: data.localFiles ?? [],
            environmentVariableOverrides: data.environmentVariableOverrides ?? {},
          },
        })

        const hasSetupWork = !!(data.repositoryId || data.installCommand || data.buildCommand)
        if (hasSetupWork) {
          setState({
            ...state,
            step: 1,
            createdServiceId: serviceId,
            createdServiceName: data.displayName!,
            hasSetupWork: true,
          })
        } else {
          noty.emit('onNotyAdded', {
            title: 'Service created',
            body: `"${data.displayName}" was created successfully.`,
            type: 'success',
          })
          stackCraftNavigate(injector, { path: '/stacks/:stackName/services', params: { stackName: props.stackName } })
        }
      } catch (error) {
        noty.emit('onNotyAdded', {
          title: 'Error',
          body: error instanceof Error ? error.message : 'Failed to create service',
          type: 'error',
        })
      }
    }

    const handleCreatePrerequisite = async (data: Partial<Prerequisite>): Promise<string> => {
      const newId = crypto.randomUUID()
      await prereqsApi.call({
        method: 'POST',
        action: '/prerequisites',
        body: {
          id: newId,
          stackName: props.stackName,
          name: data.name!,
          type: data.type!,
          config: data.config!,
          installationHelp: data.installationHelp ?? '',
        },
      })
      noty.emit('onNotyAdded', { title: 'Prerequisite added', body: `"${data.name}" was added.`, type: 'success' })
      return newId
    }

    const handleCreateRepository = async (data: Partial<GitHubRepository>): Promise<string> => {
      const newId = crypto.randomUUID()
      await reposApi.call({
        method: 'POST',
        action: '/github-repositories',
        body: {
          id: newId,
          stackName: props.stackName,
          url: data.url!,
          displayName: data.displayName!,
          description: data.description ?? '',
        },
      })
      noty.emit('onNotyAdded', {
        title: 'Repository added',
        body: `"${data.displayName}" was added.`,
        type: 'success',
      })
      return newId
    }

    const stepIndicator = (
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '24px' }}>
        <StepDot active={state.step === 0} completed={state.step > 0} label="1. Service" />
        <div
          style={{
            width: '32px',
            height: '2px',
            background: state.step > 0 ? cssVariableTheme.palette.primary.main : cssVariableTheme.divider,
          }}
        />
        <StepDot active={state.step === 1} completed={false} label="2. Setup" />
      </div>
    )

    if (state.step === 0) {
      return (
        <Paper style={{ maxWidth: '640px', margin: '32px auto', padding: '32px' }}>
          {stepIndicator}
          <p style={{ margin: '0 0 16px 0', opacity: '0.7', fontSize: '14px' }}>
            Step 1 of 2: Define the service details for the "{props.stackName}" stack.
          </p>
          <ServiceForm
            mode="create"
            stackName={props.stackName}
            repositories={repos}
            prerequisites={prereqs}
            otherServices={otherServices}
            onSubmit={(data: Partial<ServiceView>) => void handleCreateService(data)}
            onCreatePrerequisite={(data: Partial<Prerequisite>) => handleCreatePrerequisite(data)}
            onCreateRepository={(data: Partial<GitHubRepository>) => handleCreateRepository(data)}
            onCancel={() =>
              stackCraftNavigate(injector, {
                path: '/stacks/:stackName/services',
                params: { stackName: props.stackName },
              })
            }
          />
        </Paper>
      )
    }

    return (
      <Paper style={{ maxWidth: '640px', margin: '32px auto', padding: '32px' }}>
        {stepIndicator}
        <SetupStep
          stackName={props.stackName}
          serviceId={state.createdServiceId!}
          serviceName={state.createdServiceName!}
        />
      </Paper>
    )
  },
})

type StepDotProps = {
  active: boolean
  completed: boolean
  label: string
}

const StepDot = Shade<StepDotProps>({
  customElementName: 'shade-step-dot',
  render: ({ props }) => {
    const bg = props.active
      ? cssVariableTheme.palette.primary.main
      : props.completed
        ? cssVariableTheme.palette.success.main
        : cssVariableTheme.divider

    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
        <div
          style={{
            width: '10px',
            height: '10px',
            borderRadius: '50%',
            background: bg,
            transition: 'background 0.2s',
          }}
        />
        <span
          style={{
            fontSize: '13px',
            opacity: props.active ? '1' : '0.5',
            fontWeight: props.active ? '600' : '400',
          }}
        >
          {props.label}
        </span>
      </div>
    )
  },
})
