import { createComponent, Shade } from '@furystack/shades'
import { Button, Form, Icon, icons, Input } from '@furystack/shades-common-components'
import type { Dependency } from 'common'

type DependencyFormPayload = {
  name: string
  checkCommand: string
  installationHelp: string
}

const isDependencyFormPayload = (data: unknown): data is DependencyFormPayload => {
  const d = data as DependencyFormPayload
  return d.name?.length > 0 && d.checkCommand?.length > 0
}

type DependencyFormProps = {
  initial?: Partial<Dependency>
  stackName: string
  onSubmit: (data: Partial<Dependency>) => void | Promise<void>
  onCancel: () => void
  mode: 'create' | 'edit'
}

export const DependencyForm = Shade<DependencyFormProps>({
  shadowDomName: 'shade-dependency-form',
  render: ({ props }) => {
    return (
      <Form<DependencyFormPayload>
        validate={isDependencyFormPayload}
        onSubmit={(data) =>
          props.onSubmit({
            stackName: props.stackName,
            name: data.name,
            checkCommand: data.checkCommand,
            installationHelp: data.installationHelp,
          })
        }
        disableOnSubmit
        style={{ display: 'flex', flexDirection: 'column', gap: '16px', maxWidth: '600px' }}
      >
        <h2 style={{ margin: '0' }}>{props.mode === 'create' ? 'Add Dependency' : 'Edit Dependency'}</h2>
        <Input
          name="name"
          labelTitle="Name"
          variant="outlined"
          required
          value={props.initial?.name ?? ''}
          getHelperText={() => 'e.g., Node.js, Python, Docker'}
        />
        <Input
          name="checkCommand"
          labelTitle="Check Command"
          variant="outlined"
          required
          value={props.initial?.checkCommand ?? ''}
          getHelperText={() => 'Command that returns exit code 0 if installed (e.g., node --version)'}
        />
        <Input
          name="installationHelp"
          labelTitle="Installation Help"
          variant="outlined"
          value={props.initial?.installationHelp ?? ''}
          getHelperText={() => 'Instructions for installing this dependency'}
        />
        <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
          <Button variant="outlined" onclick={props.onCancel} startIcon={<Icon icon={icons.close} size="small" />}>
            Cancel
          </Button>
          <Button
            type="submit"
            variant="contained"
            startIcon={<Icon icon={props.mode === 'create' ? icons.plus : icons.save} size="small" />}
          >
            {props.mode === 'create' ? 'Add' : 'Save'}
          </Button>
        </div>
      </Form>
    )
  },
})
