import { createComponent, NestedRouteLink, Shade } from '@furystack/shades'
import {
  Button,
  Checkbox,
  cssVariableTheme,
  Form,
  Icon,
  icons,
  Input,
  MarkdownInput,
  Paper,
  Select,
} from '@furystack/shades-common-components'
import type { GitHubRepository, Prerequisite, ServiceView } from 'common'

import { prerequisiteTypeLabels } from '../status-chips.js'
import { GitHubRepoForm } from './github-repo-form.js'
import { PrerequisiteForm } from './prerequisite-form.js'

type ServiceFormPayload = {
  displayName: string
  description: string
  workingDirectory: string
  repositoryId: string
  runCommand: string
  installCommand: string
  buildCommand: string
  autoFetchEnabled: string
  autoFetchIntervalMinutes: string
  autoRestartOnFetch: string
}

const isServiceFormPayload = (data: unknown): data is ServiceFormPayload => {
  const d = data as ServiceFormPayload
  return d.displayName?.length > 0 && d.runCommand?.length > 0
}

type ServiceFormProps = {
  initial?: Partial<ServiceView>
  stackName: string
  repositories?: GitHubRepository[]
  prerequisites?: Prerequisite[]
  otherServices?: Array<{ id: string; displayName: string }>
  onSubmit: (data: Partial<ServiceView>) => void | Promise<void>
  onCreatePrerequisite?: (data: Partial<Prerequisite>) => Promise<string>
  onCreateRepository?: (data: Partial<GitHubRepository>) => Promise<string>
  onCancel?: () => void
  cancelHref?: string
  mode: 'create' | 'edit'
}

export const ServiceForm = Shade<ServiceFormProps>({
  shadowDomName: 'shade-service-form',
  render: ({ props, useState }) => {
    const [selectedPrereqIds, setSelectedPrereqIds] = useState<string[]>(
      'selectedPrereqIds',
      props.initial?.prerequisiteIds ?? [],
    )
    const [selectedPrereqServiceIds, setSelectedPrereqServiceIds] = useState<string[]>(
      'selectedPrereqServiceIds',
      props.initial?.prerequisiteServiceIds ?? [],
    )
    const [isCreatingPrereq, setIsCreatingPrereq] = useState('isCreatingPrereq', false)
    const [isCreatingRepo, setIsCreatingRepo] = useState('isCreatingRepo', false)

    const togglePrereqId = (id: string) => {
      const updated = selectedPrereqIds.includes(id)
        ? selectedPrereqIds.filter((pid) => pid !== id)
        : [...selectedPrereqIds, id]
      setSelectedPrereqIds(updated)
    }

    const togglePrereqServiceId = (id: string) => {
      const updated = selectedPrereqServiceIds.includes(id)
        ? selectedPrereqServiceIds.filter((sid) => sid !== id)
        : [...selectedPrereqServiceIds, id]
      setSelectedPrereqServiceIds(updated)
    }

    const repoOptions = [
      { value: '', label: '(None)' },
      ...(props.repositories ?? []).map((r) => ({ value: r.id, label: r.displayName })),
    ]

    return (
      <div>
        <Form<ServiceFormPayload>
          validate={isServiceFormPayload}
          onSubmit={(data) =>
            props.onSubmit({
              stackName: props.stackName,
              displayName: data.displayName,
              description: data.description,
              workingDirectory: data.workingDirectory || undefined,
              repositoryId: data.repositoryId || undefined,
              runCommand: data.runCommand,
              installCommand: data.installCommand || undefined,
              buildCommand: data.buildCommand || undefined,
              autoFetchEnabled: data.autoFetchEnabled === 'on',
              autoFetchIntervalMinutes: parseInt(data.autoFetchIntervalMinutes, 10) || 60,
              autoRestartOnFetch: data.autoRestartOnFetch === 'on',
              prerequisiteIds: selectedPrereqIds,
              prerequisiteServiceIds: selectedPrereqServiceIds,
            })
          }
          disableOnSubmit
          style={{ display: 'flex', flexDirection: 'column', gap: '16px', maxWidth: '600px' }}
        >
          <h2 style={{ margin: '0' }}>{props.mode === 'create' ? 'Create Service' : 'Edit Service'}</h2>

          <h4 style={{ margin: '0', opacity: '0.7' }}>Definition</h4>
          <Input
            name="displayName"
            labelTitle="Display Name"
            variant="outlined"
            required
            value={props.initial?.displayName ?? ''}
          />
          <MarkdownInput
            name="description"
            labelTitle="Description"
            value={props.initial?.description ?? ''}
            rows={4}
          />

          <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-end' }}>
            <div style={{ flex: '1' }}>
              <Select
                name="repositoryId"
                labelTitle="GitHub Repository"
                variant="outlined"
                placeholder="None"
                value={props.initial?.repositoryId ?? ''}
                options={repoOptions}
                getHelperText={() => 'Link this service to a repository'}
              />
            </div>
            {props.onCreateRepository ? (
              <Button
                variant="outlined"
                size="small"
                onclick={() => setIsCreatingRepo(true)}
                startIcon={<Icon icon={icons.plus} size="small" />}
                style={{ marginBottom: '4px' }}
              >
                New
              </Button>
            ) : null}
          </div>

          <Input
            name="workingDirectory"
            labelTitle="Working Directory"
            variant="outlined"
            value={props.initial?.workingDirectory ?? ''}
            getHelperText={() =>
              'Optional. Relative path within stack for grouping, e.g. frontends/public or services/gateways'
            }
          />
          <Input
            name="runCommand"
            labelTitle="Run Command"
            variant="outlined"
            required
            value={props.initial?.runCommand ?? ''}
            getHelperText={() => 'e.g., npm start, yarn dev, dotnet run'}
          />
          <Input
            name="installCommand"
            labelTitle="Install Command"
            variant="outlined"
            value={props.initial?.installCommand ?? ''}
            getHelperText={() => 'e.g., npm install, yarn, dotnet restore'}
          />
          <Input
            name="buildCommand"
            labelTitle="Build Command"
            variant="outlined"
            value={props.initial?.buildCommand ?? ''}
            getHelperText={() => 'e.g., npm run build, yarn build, dotnet build'}
          />

          {props.prerequisites ? (
            <div>
              <h4 style={{ margin: '0 0 8px 0', opacity: '0.7' }}>Prerequisites</h4>
              {props.prerequisites.length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '8px' }}>
                  {props.prerequisites.map((prereq) => {
                    const isSelected = selectedPrereqIds.includes(prereq.id)
                    return (
                      <label
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '10px',
                          padding: '8px 12px',
                          borderRadius: '8px',
                          cursor: 'pointer',
                          border: isSelected
                            ? `2px solid ${cssVariableTheme.palette.primary.main}`
                            : '2px solid rgba(255,255,255,0.1)',
                          background: isSelected ? 'rgba(255,255,255,0.03)' : 'transparent',
                          transition: 'all 0.15s',
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onchange={() => togglePrereqId(prereq.id)}
                          style={{ margin: '0' }}
                        />
                        <span style={{ fontWeight: '500' }}>{prereq.name}</span>
                        <span style={{ opacity: '0.6', fontSize: '13px' }}>
                          {prerequisiteTypeLabels[prereq.type] ?? prereq.type}
                        </span>
                      </label>
                    )
                  })}
                </div>
              ) : (
                <p style={{ margin: '0 0 8px 0', opacity: '0.6', fontSize: '14px' }}>
                  No prerequisites defined for this stack yet.
                </p>
              )}
              {props.onCreatePrerequisite ? (
                <Button
                  variant="outlined"
                  size="small"
                  onclick={() => setIsCreatingPrereq(true)}
                  startIcon={<Icon icon={icons.plus} size="small" />}
                >
                  Add Prerequisite
                </Button>
              ) : null}
            </div>
          ) : null}

          {props.otherServices && props.otherServices.length > 0 ? (
            <div>
              <h4 style={{ margin: '0 0 8px 0', opacity: '0.7' }}>Prerequisite Services</h4>
              <p style={{ margin: '0 0 8px 0', opacity: '0.6', fontSize: '13px' }}>
                Services that must be running before this one starts.
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {props.otherServices.map((svc) => {
                  const isSelected = selectedPrereqServiceIds.includes(svc.id)
                  return (
                    <label
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '10px',
                        padding: '8px 12px',
                        borderRadius: '8px',
                        cursor: 'pointer',
                        border: isSelected
                          ? `2px solid ${cssVariableTheme.palette.primary.main}`
                          : '2px solid rgba(255,255,255,0.1)',
                        background: isSelected ? 'rgba(255,255,255,0.03)' : 'transparent',
                        transition: 'all 0.15s',
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onchange={() => togglePrereqServiceId(svc.id)}
                        style={{ margin: '0' }}
                      />
                      <span style={{ fontWeight: '500' }}>{svc.displayName}</span>
                    </label>
                  )
                })}
              </div>
            </div>
          ) : null}

          <h4 style={{ margin: '0', opacity: '0.7' }}>Configuration</h4>
          <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
            <Checkbox
              name="autoFetchEnabled"
              labelTitle="Auto-fetch"
              checked={props.initial?.autoFetchEnabled ?? false}
            />
            <Input
              name="autoFetchIntervalMinutes"
              labelTitle="Fetch interval (min)"
              type="number"
              variant="outlined"
              value={String(props.initial?.autoFetchIntervalMinutes ?? 60)}
              style={{ width: '150px' }}
            />
            <Checkbox
              name="autoRestartOnFetch"
              labelTitle="Auto-restart on fetch"
              checked={props.initial?.autoRestartOnFetch ?? false}
            />
          </div>
          <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
            {props.cancelHref ? (
              <NestedRouteLink href={props.cancelHref}>
                <Button variant="outlined" startIcon={<Icon icon={icons.close} size="small" />}>
                  Cancel
                </Button>
              </NestedRouteLink>
            ) : (
              <Button variant="outlined" onclick={props.onCancel} startIcon={<Icon icon={icons.close} size="small" />}>
                Cancel
              </Button>
            )}
            <Button
              type="submit"
              variant="contained"
              startIcon={<Icon icon={props.mode === 'create' ? icons.plus : icons.save} size="small" />}
            >
              {props.mode === 'create' ? 'Create' : 'Save'}
            </Button>
          </div>
        </Form>

        {isCreatingPrereq && props.onCreatePrerequisite ? (
          <div
            style={{
              position: 'fixed',
              inset: '0',
              zIndex: '10000',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: 'rgba(0, 0, 0, 0.6)',
            }}
            onclick={(ev: MouseEvent) => {
              if (ev.target === ev.currentTarget) {
                setIsCreatingPrereq(false)
              }
            }}
          >
            <Paper
              elevation={3}
              style={{
                padding: '24px',
                minWidth: '480px',
                maxWidth: '600px',
                borderRadius: '12px',
                background: cssVariableTheme.background.paper,
              }}
            >
              <PrerequisiteForm
                stackName={props.stackName}
                mode="create"
                onSubmit={async (data) => {
                  const newId = await props.onCreatePrerequisite!(data)
                  setSelectedPrereqIds([...selectedPrereqIds, newId])
                  setIsCreatingPrereq(false)
                }}
                onCancel={() => setIsCreatingPrereq(false)}
              />
            </Paper>
          </div>
        ) : null}

        {isCreatingRepo && props.onCreateRepository ? (
          <div
            style={{
              position: 'fixed',
              inset: '0',
              zIndex: '10000',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: 'rgba(0, 0, 0, 0.6)',
            }}
            onclick={(ev: MouseEvent) => {
              if (ev.target === ev.currentTarget) {
                setIsCreatingRepo(false)
              }
            }}
          >
            <Paper
              elevation={3}
              style={{
                padding: '24px',
                minWidth: '480px',
                maxWidth: '600px',
                borderRadius: '12px',
                background: cssVariableTheme.background.paper,
              }}
            >
              <GitHubRepoForm
                stackName={props.stackName}
                mode="create"
                onSubmit={async (data) => {
                  await props.onCreateRepository!(data)
                  setIsCreatingRepo(false)
                }}
                onCancel={() => setIsCreatingRepo(false)}
              />
            </Paper>
          </div>
        ) : null}
      </div>
    )
  },
})
