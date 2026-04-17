import { createComponent, Shade } from '@furystack/shades'
import {
  Alert,
  Button,
  cssVariableTheme,
  Icon,
  icons,
  Loader,
  NotyService,
  PageContainer,
  PageHeader,
  Paper,
  TextArea,
} from '@furystack/shades-common-components'
import type { SecretWarning } from 'common'

import { StacksApiClient } from '../../services/api-clients/stacks-api-client.js'

type ExportStackProps = {
  stackName: string
}

export const ExportStack = Shade<ExportStackProps>({
  customElementName: 'shade-export-stack',
  render: ({ props, injector, useState, useDisposable }) => {
    const [jsonOutput, setJsonOutput] = useState('json', '')
    const [warnings, setWarnings] = useState<SecretWarning[]>('warnings', [])
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
          const { warnings: resultWarnings, ...exportData } = result
          setJsonOutput(JSON.stringify(exportData, null, 2))
          if (resultWarnings) {
            setWarnings(resultWarnings)
          }
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

        {warnings.length > 0 ? (
          <Alert severity="warning" title="Potential secrets detected">
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '4px' }}>
              <span style={{ fontSize: cssVariableTheme.typography.fontSize.sm }}>
                The following patterns were found that may indicate hard-coded secrets. Consider using environment
                variable prerequisites or template interpolation instead.
              </span>
              {warnings.map((w) => (
                <div
                  style={{
                    fontFamily: 'monospace',
                    fontSize: '12px',
                    padding: '6px 8px',
                    borderRadius: '4px',
                    background: 'rgba(0,0,0,0.15)',
                  }}
                >
                  <strong>{w.source}</strong> — {w.pattern}
                  <br />
                  <span style={{ opacity: '0.8' }}>{w.snippet}</span>
                  {w.suggestion ? (
                    <span>
                      <br />
                      <em>{w.suggestion}</em>
                    </span>
                  ) : null}
                </div>
              ))}
            </div>
          </Alert>
        ) : null}

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
