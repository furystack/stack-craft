import { Shade, createComponent } from '@furystack/shades'
import { Button, Form, Input, Paper } from '@furystack/shades-common-components'
import { SessionService } from '../services/session.js'

type LoginPayload = { userName: string; password: string }

export const Login = Shade({
  shadowDomName: 'shade-login',
  render: ({ injector, useObservable }) => {
    const sessionService = injector.getInstance(SessionService)
    const [isOperationInProgress] = useObservable('isOperationInProgress', sessionService.isOperationInProgress)
    const [error] = useObservable('loginError', sessionService.loginError)

    return (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          height: '100%',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '0 100px',
          paddingTop: '100px',
        }}
      >
        <Paper elevation={3}>
          <Form<LoginPayload>
            className="login-form"
            validate={(data): data is LoginPayload => {
              return (data as LoginPayload).userName?.length > 0 && (data as LoginPayload).password?.length > 0
            }}
            onSubmit={({ userName, password }) => {
              void sessionService.login(userName, password)
            }}
          >
            <h2>Login</h2>
            <Input
              labelTitle="User name"
              name="userName"
              autofocus
              required
              disabled={isOperationInProgress}
              getHelperText={() => "The user's login name"}
              type="text"
            />
            <Input
              labelTitle="Password"
              name="password"
              required
              disabled={isOperationInProgress}
              getHelperText={() => 'The password for the user'}
              type="password"
            />
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexDirection: 'row',
                padding: '1em 0',
              }}
            >
              {error ? <div style={{ color: 'red', fontSize: '12px' }}>{error}</div> : <div />}
              <Button type="submit">Login</Button>
            </div>
            <p style={{ fontSize: '10px' }}>You can login with the default 'testuser' / 'password' credentials</p>
          </Form>
        </Paper>
      </div>
    )
  },
})
