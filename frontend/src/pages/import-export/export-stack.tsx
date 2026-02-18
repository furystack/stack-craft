import { createComponent, Shade } from '@furystack/shades'
import {
  Button,
  cssVariableTheme,
  Icon,
  icons,
  Loader,
  NotyService,
  PageContainer,
  PageHeader,
  Paper,
} from '@furystack/shades-common-components'
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
      <PageContainer>
        <PageHeader
          icon="📤"
          title="Export Stack"
          description="Copy the JSON below and share it with other developers to quickly set up the same stack."
          actions={
            <Button
              variant="outlined"
              onclick={() => history.back()}
              startIcon={<Icon icon={icons.chevronLeft} size="small" />}
            >
              Back
            </Button>
          }
        />
        <Paper>
          {isLoading ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: '48px' }}>
              <Loader />
            </div>
          ) : (
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
                readOnly
                value={jsonOutput}
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
