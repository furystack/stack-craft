import { createComponent, Shade } from '@furystack/shades'

import { navigate } from '../../utils/navigate.js'
import {
  Button,
  cssVariableTheme,
  NotyService,
  PageContainer,
  PageHeader,
  Paper,
} from '@furystack/shades-common-components'
import { StacksApiClient } from '../../services/api-clients/stacks-api-client.js'

export const ImportStack = Shade({
  shadowDomName: 'shade-import-stack',
  render: ({ injector, useState }) => {
    const [jsonInput, setJsonInput] = useState('json', '')
    const [isImporting, setIsImporting] = useState('isImporting', false)

    const handleImport = async () => {
      setIsImporting(true)
      try {
        const data = JSON.parse(jsonInput)
        await injector.getInstance(StacksApiClient).call({
          method: 'POST',
          action: '/stacks/import',
          body: data,
        })
        injector.getInstance(NotyService).emit('onNotyAdded', {
          title: 'Stack imported',
          body: 'The stack was imported successfully.',
          type: 'success',
        })
        navigate(injector, '/')
      } catch (error) {
        injector.getInstance(NotyService).emit('onNotyAdded', {
          title: 'Import failed',
          body: error instanceof Error ? error.message : 'Invalid JSON or import error',
          type: 'error',
        })
      }
      setIsImporting(false)
    }

    return (
      <PageContainer>
        <PageHeader
          icon="📥"
          title="Import Stack"
          description="Paste the exported JSON data below to import a stack with all its services, repositories, and dependencies."
        />
        <Paper>
          <Paper elevation={1}>
            <textarea
              style={{
                width: '100%',
                height: '300px',
                fontFamily: 'monospace',
                fontSize: '13px',
                padding: '12px',
                background: cssVariableTheme.background.default,
                color: cssVariableTheme.text.primary,
                border: `1px solid ${cssVariableTheme.divider}`,
                borderRadius: cssVariableTheme.shape.borderRadius.md,
                resize: 'vertical',
                boxSizing: 'border-box',
              }}
              placeholder="Paste exported stack JSON here..."
              oninput={(ev) => setJsonInput((ev.target as HTMLTextAreaElement).value)}
            />
            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '16px' }}>
              <Button variant="outlined" onclick={() => navigate(injector, '/')}>
                Cancel
              </Button>
              <Button variant="contained" disabled={!jsonInput || isImporting} onclick={() => void handleImport()}>
                Import
              </Button>
            </div>
          </Paper>
        </Paper>
      </PageContainer>
    )
  },
})
