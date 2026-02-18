import { createComponent, Shade } from '@furystack/shades'
import { Button, NotyService } from '@furystack/shades-common-components'
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
        history.pushState(null, '', '/')
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
      <div style={{ padding: '24px', maxWidth: '800px' }}>
        <h2 style={{ margin: '0 0 16px 0' }}>Import Stack</h2>
        <p style={{ opacity: '0.7', marginBottom: '16px' }}>
          Paste the exported JSON data below to import a stack with all its services, repositories, and dependencies.
        </p>
        <textarea
          style={{
            width: '100%',
            height: '300px',
            fontFamily: 'monospace',
            fontSize: '13px',
            padding: '12px',
            background: '#0d1117',
            color: '#c9d1d9',
            border: '1px solid rgba(255,255,255,0.2)',
            borderRadius: '8px',
            resize: 'vertical',
          }}
          placeholder="Paste exported stack JSON here..."
          oninput={(ev) => setJsonInput((ev.target as HTMLTextAreaElement).value)}
        />
        <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '16px' }}>
          <Button variant="outlined" onclick={() => history.pushState(null, '', '/')}>
            Cancel
          </Button>
          <Button variant="contained" disabled={!jsonInput || isImporting} onclick={() => void handleImport()}>
            Import
          </Button>
        </div>
      </div>
    )
  },
})
