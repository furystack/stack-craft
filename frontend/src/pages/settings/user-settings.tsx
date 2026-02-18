import { createComponent, Shade } from '@furystack/shades'
import { PageContainer, PageHeader } from '@furystack/shades-common-components'

import { PasswordChangeForm } from './password-change-form.js'
import { ApiTokensSection } from './api-tokens-section.js'

export const UserSettings = Shade({
  shadowDomName: 'shade-user-settings',
  render: () => {
    return (
      <PageContainer maxWidth="700px" padding="16px">
        <PageHeader icon="⚙️" title="User Settings" />
        <PasswordChangeForm />
        <ApiTokensSection />
      </PageContainer>
    )
  },
})
