import { createComponent, Shade } from '@furystack/shades'
import { Wizard, cssVariableTheme } from '@furystack/shades-common-components'
import { WelcomeStep } from './welcome-step.js'
import { CheckPrerequisitesStep } from './check-prerequisites-step.js'
import { CreateAdminStep } from './create-admin-step.js'
import { SuccessStep } from './success-step.js'

export const InstallerPage = Shade({
  shadowDomName: 'shade-installer-page',
  render: () => {
    return (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          placeContent: 'center',
          alignItems: 'center',
          position: 'fixed',
          background: cssVariableTheme.background.default,
        }}
      >
        <Wizard
          steps={[WelcomeStep, CheckPrerequisitesStep, CreateAdminStep, SuccessStep]}
          onFinish={() => {
            window.location.reload()
          }}
        />
      </div>
    )
  },
})
