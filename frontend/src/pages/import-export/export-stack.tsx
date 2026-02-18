import { createComponent, Shade } from '@furystack/shades'
import { Button, NotyService } from '@furystack/shades-common-components'
import { StacksApiClient } from '../../services/api-clients/stacks-api-client.js'

type ExportStackProps = {
  stackName: string
}

export const ExportStack = Shade<ExportStackProps>({
  shadowDomName: 'shade-export-stack',
  render: ({ props, injector, useState }) => {
    const [jsonOutput, setJsonOutput] = useState('json', '')
    const [isLoading, setIsLoading] = useState('isLoading', true)

    if (isLoading && !jsonOutput) {
      injector
        .getInstance(StacksApiClient)
        .call({
          method: 'GET',
          action: '/stacks/:id/export',
          url: { id: props.stackName },
        })
        .then(({ result }) => {
          setJsonOutput(JSON.stringify(result, null, 2))
          setIsLoading(false)
        })
        .catch(() => setIsLoading(false))
    }

    return (
      <div style={{ padding: '24px', maxWidth: '800px' }}>
        <h2 style={{ margin: '0 0 16px 0' }}>Export Stack</h2>
        <p style={{ opacity: '0.7', marginBottom: '16px' }}>
          Copy the JSON below and share it with other developers to quickly set up the same stack.
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
          readOnly
          value={isLoading ? 'Loading...' : jsonOutput}
        />
        <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '16px' }}>
          <Button variant="outlined" onclick={() => history.back()}>
            Back
          </Button>
          <Button
            variant="contained"
            onclick={() => {
              void navigator.clipboard.writeText(jsonOutput)
              injector.getInstance(NotyService).emit('onNotyAdded', {
                title: 'Copied',
                body: 'Stack export data copied to clipboard.',
                type: 'success',
              })
            }}
          >
            Copy to Clipboard
          </Button>
        </div>
      </div>
    )
  },
})
