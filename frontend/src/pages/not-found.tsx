import { createComponent, Shade } from '@furystack/shades'
import { Button, cssVariableTheme, PageContainer, Paper } from '@furystack/shades-common-components'

import { stackCraftNavigate } from '../components/app-routes.js'

export const NotFound = Shade({
  customElementName: 'page-not-found',
  render: ({ injector }) => {
    return (
      <PageContainer>
        <Paper elevation={1} style={{ padding: '48px', textAlign: 'center', maxWidth: '480px', margin: '64px auto' }}>
          <h2 style={{ color: cssVariableTheme.text.primary, margin: '0 0 8px' }}>Page Not Found</h2>
          <p style={{ color: cssVariableTheme.text.secondary }}>
            The page you are looking for does not exist or has been moved.
          </p>
          <Button variant="contained" onclick={() => stackCraftNavigate(injector, { path: '/' })}>
            Go to Dashboard
          </Button>
        </Paper>
      </PageContainer>
    )
  },
})
