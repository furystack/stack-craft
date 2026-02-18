import { createComponent, Shade } from '@furystack/shades'
import type { WizardStepProps } from '@furystack/shades-common-components'
import { WizardStep } from '../../components/wizard-step.js'

export const SuccessStep = Shade<WizardStepProps>({
  shadowDomName: 'shade-success-step',
  render: ({ props }) => {
    return (
      <WizardStep title="All Done!" {...props}>
        <div style={{ textAlign: 'center', padding: '24px 0' }}>
          <h2 style={{ fontSize: '48px', margin: '0 0 16px 0' }}>&#10003;</h2>
          <p style={{ fontSize: '16px', lineHeight: '1.6' }}>
            StackCraft has been set up successfully. Click Finish to log in with your new admin account.
          </p>
        </div>
      </WizardStep>
    )
  },
})
