import { createComponent, Shade } from '@furystack/shades'
import type { WizardStepProps } from '@furystack/shades-common-components'
import { Input } from '@furystack/shades-common-components'
import { WizardStep } from '../../components/wizard-step.js'
import { InstallApiClient } from '../../services/api-clients/install-api-client.js'

export const CreateAdminStep = Shade<WizardStepProps>({
  shadowDomName: 'shade-create-admin-step',
  render: ({ props, injector }) => {
    return (
      <WizardStep
        title="Create Admin User"
        {...props}
        onSubmit={async (ev) => {
          ev.preventDefault()
          const form = ev.target as HTMLFormElement
          const formData = new FormData(form)
          const values = Object.fromEntries(formData.entries()) as { username: string; password: string }

          await injector.getInstance(InstallApiClient).call({
            method: 'POST',
            action: '/install',
            body: {
              username: values.username.toString(),
              password: values.password.toString(),
            },
          })

          props.onNext?.()
        }}
      >
        <p style={{ marginBottom: '16px' }}>Create the administrator account for StackCraft.</p>
        <Input
          name="username"
          variant="outlined"
          autofocus
          autocomplete="off"
          labelTitle="Username"
          type="text"
          required
          getHelperText={() => 'Choose a username for the admin account'}
        />
        <Input
          name="password"
          variant="outlined"
          type="password"
          labelTitle="Password"
          autocomplete="off"
          minLength={4}
          required
          getHelperText={() => 'Must be at least 4 characters'}
        />
        <input type="submit" style={{ display: 'none' }} />
      </WizardStep>
    )
  },
})
