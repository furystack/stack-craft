import { createComponent, Shade } from '@furystack/shades'
import { Button, Form, Icon, icons, Input, MarkdownEditor } from '@furystack/shades-common-components'
import type { StackView } from 'common'

import type { StaticAppRoutePath } from '../app-routes.js'
import { StackCraftNestedRouteLink } from '../app-routes.js'

type StackFormPayload = {
  name: string
  displayName: string
  description: string
  mainDirectory: string
}

export const isStackFormPayload = (data: unknown): data is StackFormPayload => {
  const d = data as StackFormPayload
  return d.name?.length > 0 && d.displayName?.length > 0 && d.mainDirectory?.length > 0
}

type StackFormProps = {
  initial?: Partial<StackView>
  onSubmit: (data: Partial<StackView>) => void | Promise<void>
  onCancel?: () => void
  cancelHref?: StaticAppRoutePath
  mode: 'create' | 'edit'
}

export const StackForm = Shade<StackFormProps>({
  customElementName: 'shade-stack-form',
  render: ({ props }) => {
    return (
      <Form<StackFormPayload>
        validate={isStackFormPayload}
        onSubmit={(data) =>
          props.onSubmit({
            name: data.name,
            displayName: data.displayName,
            description: data.description,
            mainDirectory: data.mainDirectory,
          })
        }
        disableOnSubmit
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
          readOnly={props.mode === 'edit'}
          getHelperText={() => 'Unique kebab-case identifier'}
        />
        <Input
          name="displayName"
          labelTitle="Display Name"
          variant="outlined"
          required
          value={props.initial?.displayName ?? ''}
        />
        <MarkdownEditor name="description" labelTitle="Description" value={props.initial?.description ?? ''} rows={4} />

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
            <StackCraftNestedRouteLink path={props.cancelHref}>
              <Button variant="outlined" startIcon={<Icon icon={icons.close} size="small" />}>
                Cancel
              </Button>
            </StackCraftNestedRouteLink>
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
