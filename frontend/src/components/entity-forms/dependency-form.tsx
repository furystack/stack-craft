import { createComponent, Shade } from '@furystack/shades'
import { Button, Input } from '@furystack/shades-common-components'
import type { Dependency } from 'common'

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
      <form
        style={{ display: 'flex', flexDirection: 'column', gap: '16px', maxWidth: '600px' }}
        onsubmit={async (ev) => {
          ev.preventDefault()
          const formData = new FormData(ev.target as HTMLFormElement)
          const data = Object.fromEntries(formData.entries()) as Record<string, string>
          await props.onSubmit({
            stackName: props.stackName,
            name: data.name,
            checkCommand: data.checkCommand,
            installationHelp: data.installationHelp,
          })
        }}
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
          <Button variant="outlined" onclick={props.onCancel}>
            Cancel
          </Button>
          <Button type="submit" variant="contained">
            {props.mode === 'create' ? 'Add' : 'Save'}
          </Button>
        </div>
      </form>
    )
  },
})
