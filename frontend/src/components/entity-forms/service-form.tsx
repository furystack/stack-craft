import { createComponent, Shade } from '@furystack/shades'
import { Button, Input, Select } from '@furystack/shades-common-components'
import type { GitHubRepository, Service } from 'common'

type ServiceFormProps = {
  initial?: Partial<Service>
  stackName: string
  repositories?: GitHubRepository[]
  onSubmit: (data: Partial<Service>) => void | Promise<void>
  onCancel: () => void
  mode: 'create' | 'edit'
}

export const ServiceForm = Shade<ServiceFormProps>({
  shadowDomName: 'shade-service-form',
  render: ({ props }) => {
    return (
      <form
        style={{ display: 'flex', flexDirection: 'column', gap: '16px', maxWidth: '600px' }}
        onsubmit={async (ev) => {
          ev.preventDefault()
          const formData = new FormData(ev.target as HTMLFormElement)
          const data = Object.fromEntries(formData.entries()) as Record<string, string>
          await props.onSubmit({
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
          })
        }}
      >
        <h2 style={{ margin: '0' }}>{props.mode === 'create' ? 'Create Service' : 'Edit Service'}</h2>
        <Input
          name="displayName"
          labelTitle="Display Name"
          variant="outlined"
          required
          value={props.initial?.displayName ?? ''}
        />
        <Input
          name="description"
          labelTitle="Description"
          variant="outlined"
          value={props.initial?.description ?? ''}
        />
        {props.repositories && props.repositories.length > 0 ? (
          <Select
            name="repositoryId"
            labelTitle="GitHub Repository"
            variant="outlined"
            placeholder="None"
            value={props.initial?.repositoryId ?? ''}
            options={[
              { value: '', label: '(None)' },
              ...props.repositories.map((r) => ({ value: r.id, label: r.displayName })),
            ]}
            getHelperText={() => 'Link this service to a repository'}
          />
        ) : null}
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
        <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <input type="checkbox" name="autoFetchEnabled" checked={props.initial?.autoFetchEnabled ?? false} />
            Auto-fetch
          </label>
          <Input
            name="autoFetchIntervalMinutes"
            labelTitle="Fetch interval (min)"
            type="number"
            variant="outlined"
            value={String(props.initial?.autoFetchIntervalMinutes ?? 60)}
            style={{ width: '150px' }}
          />
          <label style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <input type="checkbox" name="autoRestartOnFetch" checked={props.initial?.autoRestartOnFetch ?? false} />
            Auto-restart on fetch
          </label>
        </div>
        <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
          <Button variant="outlined" onclick={props.onCancel}>
            Cancel
          </Button>
          <Button type="submit" variant="contained">
            {props.mode === 'create' ? 'Create' : 'Save'}
          </Button>
        </div>
      </form>
    )
  },
})
