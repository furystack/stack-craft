import { createComponent, NestedRouteLink, Shade } from '@furystack/shades'
import { Button, Form, Icon, icons, Input } from '@furystack/shades-common-components'
import type { StackView } from 'common'

type StackFormPayload = {
  name: string
  displayName: string
  description: string
  mainDirectory: string
}

const isStackFormPayload = (data: unknown): data is StackFormPayload => {
  const d = data as StackFormPayload
  return d.name?.length > 0 && d.displayName?.length > 0 && d.mainDirectory?.length > 0
}

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
      <Form<StackFormPayload>
        validate={isStackFormPayload}
        onSubmit={(data) =>
          void props.onSubmit({
            name: data.name,
            displayName: data.displayName,
            description: data.description,
            mainDirectory: data.mainDirectory,
          })
        }
        style={{ display: 'flex', flexDirection: 'column', gap: '16px', maxWidth: '600px' }}
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
