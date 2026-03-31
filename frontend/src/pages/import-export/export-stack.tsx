import { createComponent, Shade } from '@furystack/shades'
import {
  Button,
  Icon,
  icons,
  Loader,
  NotyService,
  PageContainer,
  PageHeader,
  Paper,
  TextArea,
} from '@furystack/shades-common-components'
import { StacksApiClient } from '../../services/api-clients/stacks-api-client.js'

type ExportStackProps = {
  stackName: string
}

export const ExportStack = Shade<ExportStackProps>({
  customElementName: 'shade-export-stack',
  render: ({ props, injector, useState, useDisposable }) => {
    const [jsonOutput, setJsonOutput] = useState('json', '')
    const [isLoading, setIsLoading] = useState('isLoading', true)

    useDisposable('fetchExport', () => {
      void injector
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
      return { [Symbol.dispose]() {} }
    })

    return (
      <PageContainer>
        <PageHeader
          icon="📤"
          title="Export Stack"
          description="Copy the JSON below and share it with other developers to quickly set up the same stack."
        />
        <Paper>
          {isLoading ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: '48px' }}>
              <Loader />
            </div>
          ) : (
            <Paper elevation={1}>
              <TextArea
                variant="outlined"
                readOnly
                value={jsonOutput}
                style={{
                  width: '100%',
                  minHeight: '300px',
                  fontFamily: 'monospace',
                  fontSize: '13px',
                  resize: 'vertical',
                  boxSizing: 'border-box',
                }}
              />
              <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '16px' }}>
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
                  startIcon={<Icon icon={icons.clipboard} size="small" />}
                >
                  Copy to Clipboard
                </Button>
              </div>
            </Paper>
          )}
        </Paper>
      </PageContainer>
    )
  },
})
