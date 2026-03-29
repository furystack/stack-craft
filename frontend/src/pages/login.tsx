import { createComponent, Shade } from '@furystack/shades'
import { Button, cssVariableTheme, Form, Icon, icons, Input, Paper } from '@furystack/shades-common-components'
import { ThemeSwitch } from '../components/theme-switch/index.js'
import { SessionService } from '../services/session.js'

type LoginPayload = { userName: string; password: string }

export const Login = Shade({
  customElementName: 'shade-login',
  css: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    height: '100%',
    position: 'fixed',
    top: '0',
    left: '0',
    background: `linear-gradient(135deg, ${cssVariableTheme.background.default} 0%, ${cssVariableTheme.background.paper} 100%)`,

    '& .login-wrapper': {
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      gap: cssVariableTheme.spacing.lg,
      width: '100%',
      maxWidth: '420px',
      padding: `0 ${cssVariableTheme.spacing.md}`,
    },

    '& .login-branding': {
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      gap: cssVariableTheme.spacing.sm,
    },

    '& .login-logo': {
      fontSize: '48px',
      lineHeight: '1',
    },

    '& .login-title': {
      margin: '0',
      fontSize: cssVariableTheme.typography.fontSize.xl,
      fontWeight: cssVariableTheme.typography.fontWeight.bold,
      color: cssVariableTheme.text.primary,
      letterSpacing: '-0.5px',
    },

    '& .login-subtitle': {
      margin: '0',
      fontSize: cssVariableTheme.typography.fontSize.md,
      color: cssVariableTheme.text.secondary,
    },

    '& .login-card': {
      width: '100%',
    },

    '& .login-form-header': {
      display: 'flex',
      alignItems: 'center',
      gap: cssVariableTheme.spacing.sm,
      marginBottom: cssVariableTheme.spacing.lg,
      paddingBottom: cssVariableTheme.spacing.md,
      borderBottom: `1px solid ${cssVariableTheme.divider}`,
    },

    '& .login-form-header h3': {
      margin: '0',
      fontSize: cssVariableTheme.typography.fontSize.lg,
      fontWeight: cssVariableTheme.typography.fontWeight.semibold,
      color: cssVariableTheme.text.primary,
    },

    '& .login-fields': {
      display: 'flex',
      flexDirection: 'column',
      gap: cssVariableTheme.spacing.md,
    },

    '& .login-actions': {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginTop: cssVariableTheme.spacing.lg,
    },

    '& .login-error': {
      padding: `${cssVariableTheme.spacing.sm} ${cssVariableTheme.spacing.md}`,
      borderRadius: cssVariableTheme.shape.borderRadius.sm,
      backgroundColor: 'rgba(211, 47, 47, 0.1)',
      border: '1px solid rgba(211, 47, 47, 0.3)',
      color: cssVariableTheme.palette.error.main,
      fontSize: cssVariableTheme.typography.fontSize.sm,
      display: 'flex',
      alignItems: 'center',
      gap: cssVariableTheme.spacing.sm,
    },

    '& .theme-toggle': {
      position: 'fixed',
      top: cssVariableTheme.spacing.md,
      right: cssVariableTheme.spacing.md,
    },
  },
  render: ({ injector, useObservable }) => {
    const sessionService = injector.getInstance(SessionService)
    const [isOperationInProgress] = useObservable('isOperationInProgress', sessionService.isOperationInProgress)
    const [error] = useObservable('loginError', sessionService.loginError)

    return (
      <div>
        <div className="theme-toggle">
          <ThemeSwitch variant="outlined" />
        </div>
        <div className="login-wrapper">
          <div className="login-branding">
            <div className="login-logo">🔧</div>
            <h1 className="login-title">StackCraft</h1>
            <p className="login-subtitle">Manage your development stacks</p>
          </div>
          <div className="login-card">
            <Paper elevation={2}>
              <div className="login-form-header">
                <Icon icon={icons.lock} size="small" />
                <h3>Sign in</h3>
              </div>
              <Form<LoginPayload>
                validate={(data): data is LoginPayload => {
                  return (data as LoginPayload).userName?.length > 0 && (data as LoginPayload).password?.length > 0
                }}
                onSubmit={async ({ userName, password }) => {
                  await sessionService.login(userName, password)
                }}
                disableOnSubmit
              >
                <div className="login-fields">
                  <Input
                    labelTitle="Username"
                    name="userName"
                    autofocus
                    required
                    variant="outlined"
                    type="text"
                    getStartIcon={() => <Icon icon={icons.user} size="small" />}
                  />
                  <Input
                    labelTitle="Password"
                    name="password"
                    required
                    variant="outlined"
                    type="password"
                    getStartIcon={() => <Icon icon={icons.lock} size="small" />}
                  />
                </div>
                {error ? (
                  <div className="login-error">
                    <Icon icon={icons.errorCircle} size="small" />
                    {error}
                  </div>
                ) : null}
                <div className="login-actions">
                  <div />
                  <Button type="submit" variant="contained" loading={isOperationInProgress}>
                    Sign in
                  </Button>
                </div>
              </Form>
            </Paper>
          </div>
        </div>
      </div>
    )
  },
})
