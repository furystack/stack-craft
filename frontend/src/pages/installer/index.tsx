import { createComponent, Shade } from '@furystack/shades'
import { cssVariableTheme, Wizard } from '@furystack/shades-common-components'
import { CheckPrerequisitesStep } from './check-prerequisites-step.js'
import { CreateAdminStep } from './create-admin-step.js'
import { SuccessStep } from './success-step.js'
import { WelcomeStep } from './welcome-step.js'

export const InstallerPage = Shade({
  customElementName: 'shade-installer-page',
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
