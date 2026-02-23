import { useCollectionSync } from '@furystack/entity-sync-client'
import { createComponent, LocationService, NestedRouteLink, Shade } from '@furystack/shades'
import { Button, cssVariableTheme, Icon, icons, NotyService, Paper } from '@furystack/shades-common-components'
import type { GitHubRepository, Prerequisite, ServiceView } from 'common'
import { GitHubRepository as GitHubRepositoryModel, Prerequisite as PrerequisiteModel, ServiceDefinition } from 'common'

import { ServiceForm } from '../../components/entity-forms/service-form.js'
import { GitHubReposApiClient } from '../../services/api-clients/github-repos-api-client.js'
import { PrerequisitesApiClient } from '../../services/api-clients/prerequisites-api-client.js'
import { ServicesApiClient } from '../../services/api-clients/services-api-client.js'

type CreateServiceWizardProps = {
  stackName: string
}

type WizardState = {
  step: 0 | 1
  createdServiceId: string | null
  createdServiceName: string | null
  hasSetupWork: boolean
  setupStatus: 'idle' | 'running' | 'done' | 'failed'
}

export const CreateServiceWizard = Shade<CreateServiceWizardProps>({
  shadowDomName: 'shade-create-service-wizard',
  render: (options) => {
    const { props, injector, useState } = options

    const [state, setState] = useState<WizardState>('wizardState', {
      step: 0,
      createdServiceId: null,
      createdServiceName: null,
      hasSetupWork: false,
      setupStatus: 'idle',
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

    const servicesApi = injector.getInstance(ServicesApiClient)
    const reposApi = injector.getInstance(GitHubReposApiClient)
    const prereqsApi = injector.getInstance(PrerequisitesApiClient)
    const noty = injector.getInstance(NotyService)

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
          injector.getInstance(LocationService).navigate('/')
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
            background: state.step > 0 ? cssVariableTheme.palette.primary.main : 'rgba(255,255,255,0.15)',
          }}
        />
        <StepDot active={state.step === 1} completed={false} label="2. Setup" />
      </div>
    )

    const handleSetupNow = async () => {
      if (!state.createdServiceId) return
      setState({ ...state, setupStatus: 'running' })
      try {
        await servicesApi.call({
          method: 'POST',
          action: '/services/:id/setup',
          url: { id: state.createdServiceId },
        })
        setState({ ...state, setupStatus: 'done' })
        noty.emit('onNotyAdded', {
          title: 'Setup complete',
          body: `"${state.createdServiceName}" has been set up successfully.`,
          type: 'success',
        })
      } catch (error) {
        setState({ ...state, setupStatus: 'failed' })
        noty.emit('onNotyAdded', {
          title: 'Setup failed',
          body: error instanceof Error ? error.message : 'Setup error',
          type: 'error',
        })
      }
    }

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
            cancelHref="/"
          />
        </Paper>
      )
    }

    return (
      <Paper style={{ maxWidth: '640px', margin: '32px auto', padding: '32px' }}>
        {stepIndicator}
        <h2 style={{ margin: '0 0 4px 0' }}>Set Up Service</h2>
        <p style={{ margin: '0 0 20px 0', opacity: '0.7', fontSize: '14px' }}>
          Step 2 of 2: Clone the repository, install packages, and build "{state.createdServiceName}".
        </p>

        {state.setupStatus === 'idle' ? (
          <div style={{ textAlign: 'center', padding: '24px 0' }}>
            <p style={{ margin: '0 0 16px 0' }}>
              This will clone the repository, install packages, and build the service.
            </p>
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
              <Button
                variant="contained"
                onclick={() => void handleSetupNow()}
                startIcon={<Icon icon={icons.settings} size="small" />}
              >
                Set Up Now
              </Button>
              <Button
                variant="outlined"
                onclick={() => injector.getInstance(LocationService).navigate('/')}
                endIcon={<Icon icon={icons.chevronRight} size="small" />}
              >
                Skip
              </Button>
            </div>
          </div>
        ) : null}

        {state.setupStatus === 'running' ? (
          <div style={{ textAlign: 'center', padding: '24px 0' }}>
            <p style={{ margin: '0 0 8px 0' }}>Setting up service...</p>
            <p style={{ margin: '0', fontSize: '13px', opacity: '0.6' }}>
              This may take a few minutes. You can view progress in the service logs.
            </p>
          </div>
        ) : null}

        {state.setupStatus === 'done' ? (
          <div style={{ textAlign: 'center', padding: '24px 0' }}>
            <p style={{ margin: '0 0 16px 0', color: cssVariableTheme.palette.success.main }}>
              Service set up successfully!
            </p>
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
              <Button
                variant="contained"
                color="success"
                onclick={() => injector.getInstance(LocationService).navigate('/')}
                startIcon={<Icon icon={icons.home} size="small" />}
              >
                Go to Dashboard
              </Button>
              {state.createdServiceId ? (
                <NestedRouteLink href={`/services/${state.createdServiceId}`}>
                  <Button variant="outlined" startIcon={<Icon icon={icons.eye} size="small" />}>
                    View Service
                  </Button>
                </NestedRouteLink>
              ) : null}
            </div>
          </div>
        ) : null}

        {state.setupStatus === 'failed' ? (
          <div style={{ textAlign: 'center', padding: '24px 0' }}>
            <p style={{ margin: '0 0 16px 0', color: cssVariableTheme.palette.error.main }}>Setup failed.</p>
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
              <Button
                variant="outlined"
                onclick={() => setState({ ...state, setupStatus: 'idle' })}
                startIcon={<Icon icon={icons.refresh} size="small" />}
              >
                Retry
              </Button>
              {state.createdServiceId ? (
                <NestedRouteLink href={`/services/${state.createdServiceId}/logs`}>
                  <Button variant="outlined" startIcon={<Icon icon={icons.fileText} size="small" />}>
                    View Logs
                  </Button>
                </NestedRouteLink>
              ) : null}
              <Button
                variant="outlined"
                onclick={() => injector.getInstance(LocationService).navigate('/')}
                startIcon={<Icon icon={icons.home} size="small" />}
              >
                Go to Dashboard
              </Button>
            </div>
          </div>
        ) : null}
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
  shadowDomName: 'shade-step-dot',
  render: ({ props }) => {
    const bg = props.active
      ? cssVariableTheme.palette.primary.main
      : props.completed
        ? cssVariableTheme.palette.success.main
        : 'rgba(255,255,255,0.15)'

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
