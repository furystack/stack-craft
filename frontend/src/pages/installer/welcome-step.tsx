import { createComponent, Shade } from '@furystack/shades'
import type { WizardStepProps } from '@furystack/shades-common-components'
import { WizardStep } from '../../components/wizard-step.js'

export const WelcomeStep = Shade<WizardStepProps>({
  shadowDomName: 'shade-welcome-step',
  render: ({ props }) => {
    return (
      <WizardStep title="Welcome to StackCraft" {...props}>
        <div style={{ textAlign: 'center', padding: '24px 0' }}>
          <h2 style={{ fontSize: '48px', margin: '0 0 16px 0' }}>&#9881;</h2>
          <p style={{ fontSize: '16px', lineHeight: '1.6' }}>
            It looks like StackCraft needs to be set up. This wizard will guide you through the initial configuration.
          </p>
        </div>
      </WizardStep>
    )
  },
})
