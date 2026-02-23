import { createComponent, NestedRouteLink, Shade } from '@furystack/shades'
import { Button, Checkbox, Form, Icon, icons, Input, MarkdownInput, Select } from '@furystack/shades-common-components'
import type { GitHubRepository, ServiceView } from 'common'

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
  onSubmit: (data: Partial<ServiceView>) => void | Promise<void>
  onCancel?: () => void
  cancelHref?: string
  mode: 'create' | 'edit'
}

export const ServiceForm = Shade<ServiceFormProps>({
  shadowDomName: 'shade-service-form',
  render: ({ props }) => {
    return (
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
    )
  },
})
