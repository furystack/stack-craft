import { createComponent, Shade } from '@furystack/shades'
import type { WizardStepProps } from '@furystack/shades-common-components'
import { cssVariableTheme } from '@furystack/shades-common-components'
import { WizardStep } from '../../components/wizard-step.js'

export const CheckPrerequisitesStep = Shade<WizardStepProps>({
  customElementName: 'shade-check-prerequisites-step',
  render: ({ props }) => {
    return (
      <WizardStep title="Prerequisites" {...props}>
        <p style={{ marginBottom: '16px' }}>
          Please ensure the following tools are installed on your system before proceeding:
        </p>
        <ul style={{ listStyle: 'none', padding: '0', margin: '0' }}>
          {[
            { name: 'Git', description: 'Version control for cloning repositories' },
            { name: 'GitHub CLI (gh)', description: 'For interacting with GitHub repositories' },
            { name: 'Node.js', description: 'JavaScript runtime for running services' },
          ].map((prereq) => (
            <li
              style={{
                padding: '12px 16px',
                marginBottom: '8px',
                borderRadius: '8px',
                border: `1px solid ${cssVariableTheme.divider}`,
                background: cssVariableTheme.button.hover,
              }}
            >
              <strong>{prereq.name}</strong>
              <br />
              <span style={{ opacity: '0.7', fontSize: cssVariableTheme.typography.fontSize.md }}>
                {prereq.description}
              </span>
            </li>
          ))}
        </ul>
      </WizardStep>
    )
  },
})
