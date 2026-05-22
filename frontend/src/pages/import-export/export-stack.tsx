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
} from '@furystack/shades-common-components'
import type { SecretWarning } from 'common'

import { LazyMonacoEditor } from '../../components/lazy-monaco-editor.js'
import { StacksApiClient } from '../../services/api-clients/stacks-api-client.js'
import { stackExportSchema } from './stack-export-schema.js'

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
        .get(StacksApiClient)
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

    const handleCopy = () => {
      void navigator.clipboard.writeText(jsonOutput)
      injector.get(NotyService).emit('onNotyAdded', {
        title: 'Copied',
        body: 'Stack export data copied to clipboard.',
        type: 'success',
      })
    }

    const hasWarnings = warnings.length > 0
    // Reserve viewport space for sticky header (~190px), warnings panel when shown (~240px),
    // and surrounding paddings/gaps. Keeps total content within viewport so the page itself
    // doesn't introduce a second scrollbar alongside Monaco's internal one.
    const editorHeight = hasWarnings ? 'calc(100vh - 520px)' : 'calc(100vh - 280px)'

    return (
      <PageContainer>
        <PageHeader
          icon="📤"
          title="Export Stack"
          description="Copy the JSON below and share it with other developers to quickly set up the same stack."
          actions={
            <Button
              variant="contained"
              disabled={isLoading || !jsonOutput}
              onclick={handleCopy}
              startIcon={<Icon icon={icons.clipboard} size="small" />}
            >
              Copy to Clipboard
            </Button>
          }
        />

        {hasWarnings ? (
          <Alert severity="warning" title="Potential secrets detected">
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '4px' }}>
              <span style={{ fontSize: cssVariableTheme.typography.fontSize.sm }}>
                The following patterns were found that may indicate hard-coded secrets. Consider using environment
                variable prerequisites or template interpolation instead.
              </span>
              <div
                style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '180px', overflow: 'auto' }}
              >
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
            </div>
          </Alert>
        ) : null}

        <Paper elevation={1}>
          {isLoading ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: '48px' }}>
              <Loader />
            </div>
          ) : (
            <div
              style={{
                height: editorHeight,
                minHeight: '300px',
                border: `1px solid ${cssVariableTheme.divider}`,
                borderRadius: '4px',
                overflow: 'hidden',
              }}
            >
              <LazyMonacoEditor
                value={jsonOutput}
                language="json"
                readOnly
                schemaInfo={{ schemaName: 'ExportStackResult', jsonSchema: stackExportSchema }}
              />
            </div>
          )}
        </Paper>
      </PageContainer>
    )
  },
})
