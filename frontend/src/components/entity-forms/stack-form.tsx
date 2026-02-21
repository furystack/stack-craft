import { createComponent, NestedRouteLink, Shade } from '@furystack/shades'
import { Button, Input } from '@furystack/shades-common-components'
import type { StackView } from 'common'

type StackFormProps = {
  initial?: Partial<StackView>
  onSubmit: (data: Partial<StackView>) => void | Promise<void>
  onCancel?: () => void
  cancelHref?: string
  mode: 'create' | 'edit'
}

export const StackForm = Shade<StackFormProps>({
  shadowDomName: 'shade-stack-form',
  render: ({ props }) => {
    return (
      <form
        style={{ display: 'flex', flexDirection: 'column', gap: '16px', maxWidth: '600px' }}
        onsubmit={async (ev) => {
          ev.preventDefault()
          const formData = new FormData(ev.target as HTMLFormElement)
          const data = Object.fromEntries(formData.entries()) as Record<string, string>
          await props.onSubmit({
            name: data.name,
            displayName: data.displayName,
            description: data.description,
            mainDirectory: data.mainDirectory,
          })
        }}
      >
        <h2 style={{ margin: '0' }}>{props.mode === 'create' ? 'Create Stack' : 'Edit Stack'}</h2>

        <h4 style={{ margin: '0', opacity: '0.7' }}>Definition</h4>
        <Input
          name="name"
          labelTitle="Name (identifier)"
          variant="outlined"
          required
          value={props.initial?.name ?? ''}
          disabled={props.mode === 'edit'}
          getHelperText={() => 'Unique kebab-case identifier'}
        />
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

        <h4 style={{ margin: '0', opacity: '0.7' }}>Configuration</h4>
        <Input
          name="mainDirectory"
          labelTitle="Main Directory"
          variant="outlined"
          required
          value={props.initial?.mainDirectory ?? ''}
          getHelperText={() => 'Absolute path to the root directory for this stack'}
        />
        <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
          {props.cancelHref ? (
            <NestedRouteLink href={props.cancelHref}>
              <Button variant="outlined">Cancel</Button>
            </NestedRouteLink>
          ) : (
            <Button variant="outlined" onclick={props.onCancel}>
              Cancel
            </Button>
          )}
          <Button type="submit" variant="contained">
            {props.mode === 'create' ? 'Create' : 'Save'}
          </Button>
        </div>
      </form>
    )
  },
})
