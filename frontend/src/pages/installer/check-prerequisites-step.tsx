import { createComponent, Shade } from '@furystack/shades'
import type { WizardStepProps } from '@furystack/shades-common-components'
import { WizardStep } from '../../components/wizard-step.js'

export const CheckPrerequisitesStep = Shade<WizardStepProps>({
  shadowDomName: 'shade-check-prerequisites-step',
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
                border: '1px solid rgba(255, 255, 255, 0.1)',
                background: 'rgba(255, 255, 255, 0.03)',
              }}
            >
              <strong>{prereq.name}</strong>
              <br />
              <span style={{ opacity: '0.7', fontSize: '14px' }}>{prereq.description}</span>
            </li>
          ))}
        </ul>
      </WizardStep>
    )
  },
})
