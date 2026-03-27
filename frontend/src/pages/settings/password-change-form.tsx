import { createComponent, Shade } from '@furystack/shades'
import { Button, Form, Icon, icons, Input, NotyService, Paper } from '@furystack/shades-common-components'

import { IdentityApiClient } from '../../services/api-clients/identity-api-client.js'

type PasswordChangePayload = {
  currentPassword: string
  newPassword: string
  confirmNewPassword: string
}

const isPasswordChangePayload = (data: unknown): data is PasswordChangePayload => {
  const d = data as PasswordChangePayload
  return d.currentPassword?.length > 0 && d.newPassword?.length >= 4 && d.confirmNewPassword === d.newPassword
}

export const PasswordChangeForm = Shade({
  customElementName: 'shade-password-change-form',
  render: ({ injector, useState }) => {
    const identityApi = injector.getInstance(IdentityApiClient)
    const notys = injector.getInstance(NotyService)

    const [newPassword, setNewPassword] = useState('newPassword', '')

    const handleSubmit = async (payload: PasswordChangePayload) => {
      try {
        await identityApi.call({
          method: 'POST',
          action: '/password-reset',
          body: {
            currentPassword: payload.currentPassword,
            newPassword: payload.newPassword,
          },
        })
        notys.emit('onNotyAdded', {
          title: 'Password changed',
          body: 'Your password has been updated.',
          type: 'success',
        })
      } catch {
        notys.emit('onNotyAdded', { title: 'Error', body: 'Failed to change password.', type: 'error' })
      }
    }

    return (
      <Paper elevation={1}>
        <h3 style={{ margin: '0 0 16px 0' }}>
          <Icon icon={icons.lock} size="small" style={{ marginRight: '8px', verticalAlign: 'middle' }} />
          Change Password
        </h3>
        <Form<PasswordChangePayload>
          validate={isPasswordChangePayload}
          onSubmit={handleSubmit}
          disableOnSubmit
          style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}
        >
          <Input name="currentPassword" labelTitle="Current Password" type="password" variant="outlined" required />
          <Input
            name="newPassword"
            labelTitle="New Password"
            type="password"
            variant="outlined"
            required
            minLength={4}
            onTextChange={(value) => setNewPassword(value)}
          />
          <Input
            name="confirmNewPassword"
            labelTitle="Confirm New Password"
            type="password"
            variant="outlined"
            required
            minLength={4}
            getValidationResult={({ state }) => {
              if (state.value && newPassword && state.value !== newPassword) {
                return { isValid: false, message: 'Passwords do not match' }
              }
              return { isValid: true }
            }}
          />
          <Button
            type="submit"
            variant="contained"
            startIcon={<Icon icon={icons.save} size="small" />}
            style={{ alignSelf: 'flex-start' }}
          >
            Change Password
          </Button>
        </Form>
      </Paper>
    )
  },
})
