import { createComponent, Shade } from '@furystack/shades'
import type { WizardStepProps } from '@furystack/shades-common-components'
import { Button, Form, Input } from '@furystack/shades-common-components'
import { InstallApiClient } from '../../services/api-clients/install-api-client.js'

type AdminPayload = {
  username: string
  password: string
}

const isAdminPayload = (data: unknown): data is AdminPayload => {
  const d = data as AdminPayload
  return d.username?.length > 0 && d.password?.length >= 4
}

export const CreateAdminStep = Shade<WizardStepProps>({
  shadowDomName: 'shade-create-admin-step',
  render: ({ props, injector, useState }) => {
    const [isInstalling, setIsInstalling] = useState('isInstalling', false)

    const handleSubmit = (data: AdminPayload) => {
      setIsInstalling(true)
      injector
        .getInstance(InstallApiClient)
        .call({
          method: 'POST',
          action: '/install',
          body: data,
        })
        .then(() => {
          props.onNext?.()
          setIsInstalling(false)
        })
        .catch(() => {
          setIsInstalling(false)
        })
    }

    return (
      <Form<AdminPayload>
        validate={isAdminPayload}
        onSubmit={handleSubmit}
        style={{
          padding: '32px',
          display: 'flex',
          flexDirection: 'column',
          height: '430px',
          width: '600px',
          maxWidth: 'calc(100vw - 64px)',
          justifyContent: 'space-between',
        }}
      >
        <h1 style={{ margin: '0 0 16px 0' }}>Create Admin User</h1>
        <div style={{ flexGrow: '1', overflow: 'auto', padding: '0 2px' }}>
          <p style={{ marginBottom: '16px' }}>Create the administrator account for StackCraft.</p>
          <Input
            name="username"
            variant="outlined"
            autofocus
            autocomplete="off"
            labelTitle="Username"
            type="text"
            required
            disabled={isInstalling}
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
            disabled={isInstalling}
            getHelperText={() => 'Must be at least 4 characters'}
          />
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: '16px' }}>
          <Button onclick={() => props.onPrev?.()} disabled={props.currentPage < 1} variant="outlined">
            Previous
          </Button>
          <Button
            type="submit"
            disabled={props.currentPage > props.maxPages - 1}
            loading={isInstalling}
            variant="contained"
            color={props.currentPage === props.maxPages - 1 ? 'success' : 'primary'}
          >
            {props.currentPage < props.maxPages - 1 ? 'Next' : 'Finish'}
          </Button>
        </div>
      </Form>
    )
  },
})
