import { useCollectionSync } from '@furystack/entity-sync-client'
import { createComponent, NestedRouteLink, Shade } from '@furystack/shades'

import { navigate } from '../../utils/navigate.js'
import { Button, Input, NotyService, Paper, Select, cssVariableTheme } from '@furystack/shades-common-components'
import type { GitHubRepository } from 'common'
import { GitHubRepository as GitHubRepositoryModel } from 'common'

import { GitHubReposApiClient } from '../../services/api-clients/github-repos-api-client.js'
import { ServicesApiClient } from '../../services/api-clients/services-api-client.js'

type CreateServiceWizardProps = {
  stackName: string
}

type WizardState = {
  step: 0 | 1 | 2
  createdServiceId: string | null
  createdServiceName: string | null
  hasRepoOrCommands: boolean
  repoChoice: 'skip' | 'existing' | 'new'
  selectedRepoId: string
  isSaving: boolean
  setupStatus: 'idle' | 'running' | 'done' | 'failed'
}

export const CreateServiceWizard = Shade<CreateServiceWizardProps>({
  shadowDomName: 'shade-create-service-wizard',
  render: (options) => {
    const { props, injector, useState, useRef } = options

    const [state, setState] = useState<WizardState>('wizardState', {
      step: 0,
      createdServiceId: null,
      createdServiceName: null,
      hasRepoOrCommands: false,
      repoChoice: 'skip',
      selectedRepoId: '',
      isSaving: false,
      setupStatus: 'idle',
    })

    const reposState = useCollectionSync(options, GitHubRepositoryModel, {
      filter: { stackName: { $eq: props.stackName } },
    })
    const repos = reposState.status === 'synced' || reposState.status === 'cached' ? reposState.data : []

    const repoFormRef = useRef<HTMLFormElement>('repoForm')

    const servicesApi = injector.getInstance(ServicesApiClient)
    const reposApi = injector.getInstance(GitHubReposApiClient)
    const noty = injector.getInstance(NotyService)

    const handleCreateService = async (ev: Event) => {
      ev.preventDefault()
      const form = ev.target as HTMLFormElement
      const formData = new FormData(form)
      const data = Object.fromEntries(formData.entries()) as Record<string, string>

      const serviceId = crypto.randomUUID()
      setState({ ...state, isSaving: true })

      try {
        await servicesApi.call({
          method: 'POST',
          action: '/services',
          body: {
            id: serviceId,
            stackName: props.stackName,
            displayName: data.displayName,
            description: data.description ?? '',
            workingDirectory: data.workingDirectory || undefined,
            runCommand: data.runCommand,
            installCommand: data.installCommand || undefined,
            buildCommand: data.buildCommand || undefined,
            autoFetchEnabled: false,
            autoFetchIntervalMinutes: 60,
            autoRestartOnFetch: false,
            dependencyIds: [],
            prerequisiteServiceIds: [],
          },
        })
        setState({
          ...state,
          step: 1,
          createdServiceId: serviceId,
          createdServiceName: data.displayName,
          hasRepoOrCommands: !!(data.installCommand || data.buildCommand),
          isSaving: false,
        })
      } catch (error) {
        noty.emit('onNotyAdded', {
          title: 'Error',
          body: error instanceof Error ? error.message : 'Failed to create service',
          type: 'error',
        })
        setState({ ...state, isSaving: false })
      }
    }

    const handleFinish = async () => {
      if (state.repoChoice === 'skip' || !state.createdServiceId) {
        noty.emit('onNotyAdded', {
          title: 'Service created',
          body: `"${state.createdServiceName}" was created successfully.`,
          type: 'success',
        })
        navigate(injector, '/')
        return
      }

      setState({ ...state, isSaving: true })

      try {
        let repoId = ''

        if (state.repoChoice === 'existing' && state.selectedRepoId) {
          repoId = state.selectedRepoId
        }

        if (state.repoChoice === 'new') {
          const form = repoFormRef.current
          if (form) {
            const formData = new FormData(form)
            const data = Object.fromEntries(formData.entries()) as Record<string, string>
            if (!data.url || !data.displayName) {
              setState({ ...state, isSaving: false })
              return
            }
            const newId = crypto.randomUUID()
            await reposApi.call({
              method: 'POST',
              action: '/github-repositories',
              body: {
                id: newId,
                stackName: props.stackName,
                url: data.url,
                displayName: data.displayName,
                description: data.description ?? '',
              },
            })
            repoId = newId
          }
        }

        if (repoId) {
          await servicesApi.call({
            method: 'PATCH',
            action: '/services/:id',
            url: { id: state.createdServiceId },
            body: { repositoryId: repoId },
          })
        }

        noty.emit('onNotyAdded', {
          title: 'Service created',
          body: `"${state.createdServiceName}" was created${repoId ? ' and linked to a repository' : ''}.`,
          type: 'success',
        })

        const hasSetupWork = !!(repoId || state.hasRepoOrCommands)
        if (hasSetupWork) {
          setState({ ...state, step: 2, isSaving: false })
        } else {
          navigate(injector, '/')
        }
      } catch (error) {
        noty.emit('onNotyAdded', {
          title: 'Error',
          body: error instanceof Error ? error.message : 'Failed to complete setup',
          type: 'error',
        })
        setState({ ...state, isSaving: false })
      }
    }

    const stepIndicator = (
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '24px' }}>
        <StepDot active={state.step === 0} completed={state.step > 0} label="1. Service" />
        <div
          style={{
            width: '40px',
            height: '2px',
            background: state.step > 0 ? cssVariableTheme.palette.primary.main : 'rgba(255,255,255,0.15)',
          }}
        />
        <StepDot active={state.step === 1} completed={state.step > 1} label="2. Repository" />
        <div
          style={{
            width: '40px',
            height: '2px',
            background: state.step > 1 ? cssVariableTheme.palette.primary.main : 'rgba(255,255,255,0.15)',
          }}
        />
        <StepDot active={state.step === 2} completed={false} label="3. Setup" />
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
          <form onsubmit={handleCreateService} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <h2 style={{ margin: '0' }}>Create Service</h2>
            <p style={{ margin: '0', opacity: '0.7', fontSize: '14px' }}>
              Step 1 of 3: Define the service details for the "{props.stackName}" stack.
            </p>
            <Input name="displayName" labelTitle="Display Name" variant="outlined" required autofocus />
            <Input name="description" labelTitle="Description" variant="outlined" />
            <Input
              name="workingDirectory"
              labelTitle="Working Directory"
              variant="outlined"
              getHelperText={() =>
                'Optional. Relative path within stack for grouping, e.g. frontends/public or services/gateways'
              }
            />
            <Input
              name="runCommand"
              labelTitle="Run Command"
              variant="outlined"
              required
              getHelperText={() => 'e.g., npm start, yarn dev, dotnet run'}
            />
            <Input
              name="installCommand"
              labelTitle="Install Command"
              variant="outlined"
              getHelperText={() => 'e.g., npm install, yarn, dotnet restore'}
            />
            <Input
              name="buildCommand"
              labelTitle="Build Command"
              variant="outlined"
              getHelperText={() => 'e.g., npm run build, yarn build, dotnet build'}
            />
            <div style={{ display: 'flex', gap: '8px', justifyContent: 'space-between', paddingTop: '8px' }}>
              <NestedRouteLink href="/">
                <Button variant="outlined">Cancel</Button>
              </NestedRouteLink>
              <Button type="submit" variant="contained" disabled={state.isSaving}>
                {state.isSaving ? 'Creating...' : 'Next'}
              </Button>
            </div>
          </form>
        </Paper>
      )
    }

    if (state.step === 1) {
      return (
        <Paper style={{ maxWidth: '640px', margin: '32px auto', padding: '32px' }}>
          {stepIndicator}
          <h2 style={{ margin: '0 0 4px 0' }}>Link a Repository</h2>
          <p style={{ margin: '0 0 20px 0', opacity: '0.7', fontSize: '14px' }}>
            Step 2 of 3: Optionally link a GitHub repository to "{state.createdServiceName}".
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '20px' }}>
            <RepoChoiceOption
              value="skip"
              selected={state.repoChoice === 'skip'}
              label="Skip — no repository"
              onSelect={() => setState({ ...state, repoChoice: 'skip', selectedRepoId: '' })}
            />
            {repos.length > 0 ? (
              <RepoChoiceOption
                value="existing"
                selected={state.repoChoice === 'existing'}
                label="Select an existing repository"
                onSelect={() => setState({ ...state, repoChoice: 'existing' })}
              />
            ) : null}
            <RepoChoiceOption
              value="new"
              selected={state.repoChoice === 'new'}
              label="Create a new repository"
              onSelect={() => setState({ ...state, repoChoice: 'new', selectedRepoId: '' })}
            />
          </div>

          {state.repoChoice === 'existing' ? (
            <div style={{ marginBottom: '16px' }}>
              <Select
                name="existingRepo"
                labelTitle="Repository"
                variant="outlined"
                placeholder="Select a repository..."
                value={state.selectedRepoId}
                options={repos.map((r: GitHubRepository) => ({ value: r.id, label: `${r.displayName} — ${r.url}` }))}
                onValueChange={(value: string) => setState({ ...state, selectedRepoId: value })}
              />
            </div>
          ) : null}

          {state.repoChoice === 'new' ? (
            <form
              ref={repoFormRef}
              style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginBottom: '16px' }}
            >
              <Input
                name="url"
                labelTitle="Repository URL"
                variant="outlined"
                required
                getHelperText={() => 'Full GitHub URL, e.g. https://github.com/org/repo'}
              />
              <Input name="displayName" labelTitle="Display Name" variant="outlined" required />
              <Input name="description" labelTitle="Description" variant="outlined" />
            </form>
          ) : null}

          <div style={{ display: 'flex', gap: '8px', justifyContent: 'space-between', paddingTop: '8px' }}>
            <Button variant="outlined" onclick={() => setState({ ...state, step: 0 })}>
              Back
            </Button>
            <Button
              variant="contained"
              color="success"
              disabled={state.isSaving || (state.repoChoice === 'existing' && !state.selectedRepoId)}
              onclick={() => void handleFinish()}
            >
              {state.isSaving ? 'Saving...' : 'Next'}
            </Button>
          </div>
        </Paper>
      )
    }

    return (
      <Paper style={{ maxWidth: '640px', margin: '32px auto', padding: '32px' }}>
        {stepIndicator}
        <h2 style={{ margin: '0 0 4px 0' }}>Set Up Service</h2>
        <p style={{ margin: '0 0 20px 0', opacity: '0.7', fontSize: '14px' }}>
          Step 3 of 3: Clone the repository, install dependencies, and build "{state.createdServiceName}".
        </p>

        {state.setupStatus === 'idle' ? (
          <div style={{ textAlign: 'center', padding: '24px 0' }}>
            <p style={{ margin: '0 0 16px 0' }}>
              This will clone the repository, install dependencies, and build the service.
            </p>
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
              <Button variant="contained" onclick={() => void handleSetupNow()}>
                Set Up Now
              </Button>
              <Button variant="outlined" onclick={() => navigate(injector, '/')}>
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
              <Button variant="contained" color="success" onclick={() => navigate(injector, '/')}>
                Go to Dashboard
              </Button>
              {state.createdServiceId ? (
                <NestedRouteLink href={`/services/${state.createdServiceId}`}>
                  <Button variant="outlined">View Service</Button>
                </NestedRouteLink>
              ) : null}
            </div>
          </div>
        ) : null}

        {state.setupStatus === 'failed' ? (
          <div style={{ textAlign: 'center', padding: '24px 0' }}>
            <p style={{ margin: '0 0 16px 0', color: cssVariableTheme.palette.error.main }}>Setup failed.</p>
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
              <Button variant="outlined" onclick={() => setState({ ...state, setupStatus: 'idle' })}>
                Retry
              </Button>
              {state.createdServiceId ? (
                <NestedRouteLink href={`/services/${state.createdServiceId}/logs`}>
                  <Button variant="outlined">View Logs</Button>
                </NestedRouteLink>
              ) : null}
              <Button variant="outlined" onclick={() => navigate(injector, '/')}>
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

type RepoChoiceOptionProps = {
  value: string
  selected: boolean
  label: string
  onSelect: () => void
}

const RepoChoiceOption = Shade<RepoChoiceOptionProps>({
  shadowDomName: 'shade-repo-choice-option',
  render: ({ props }) => {
    return (
      <label
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          padding: '10px 14px',
          borderRadius: '8px',
          cursor: 'pointer',
          border: props.selected
            ? `2px solid ${cssVariableTheme.palette.primary.main}`
            : '2px solid rgba(255,255,255,0.1)',
          background: props.selected ? 'rgba(255,255,255,0.03)' : 'transparent',
          transition: 'all 0.15s',
        }}
      >
        <input
          type="radio"
          name="repoChoice"
          value={props.value}
          checked={props.selected}
          onchange={props.onSelect}
          style={{ margin: '0' }}
        />
        <span style={{ fontSize: '14px' }}>{props.label}</span>
      </label>
    )
  },
})
