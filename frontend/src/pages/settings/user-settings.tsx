import { createComponent, Shade } from '@furystack/shades'
import { PageContainer, PageHeader } from '@furystack/shades-common-components'

import { ApiTokensSection } from './api-tokens-section.js'
import { PasswordChangeForm } from './password-change-form.js'
import { ThemeSelector } from './theme-selector.js'

export const UserSettings = Shade({
  customElementName: 'shade-user-settings',
  render: () => {
    return (
      <PageContainer maxWidth="700px" padding="16px">
        <PageHeader icon="⚙️" title="User Settings" />
        <ThemeSelector />
        <PasswordChangeForm />
        <ApiTokensSection />
      </PageContainer>
    )
  },
})
