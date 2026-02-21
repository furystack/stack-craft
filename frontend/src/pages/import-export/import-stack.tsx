import { createComponent, NestedRouteLink, Shade } from '@furystack/shades'

import { navigate } from '../../utils/navigate.js'
import {
  Button,
  Input,
  cssVariableTheme,
  NotyService,
  PageContainer,
  PageHeader,
  Paper,
} from '@furystack/shades-common-components'
import type { ExportStackEndpoint } from 'common'
import { StacksApiClient } from '../../services/api-clients/stacks-api-client.js'

type ParsedExport = ExportStackEndpoint['result']

export const ImportStack = Shade({
  shadowDomName: 'shade-import-stack',
  render: ({ injector, useState }) => {
    const [jsonInput, setJsonInput] = useState('json', '')
    const [parsed, setParsed] = useState<ParsedExport | null>('parsed', null)
    const [parseError, setParseError] = useState('parseError', '')
    const [mainDirectory, setMainDirectory] = useState('mainDirectory', '')
    const [autoSetup, setAutoSetup] = useState('autoSetup', true)
    const [isImporting, setIsImporting] = useState('isImporting', false)

    const handleParse = () => {
      try {
        const data = JSON.parse(jsonInput) as ParsedExport
        if (!data.stack?.name) {
          setParseError('Invalid export: missing stack name')
          setParsed(null)
          return
        }
        setParsed(data)
        setParseError('')
      } catch {
        setParseError('Invalid JSON')
        setParsed(null)
      }
    }

    const handleImport = async () => {
      if (!parsed || !mainDirectory) return
      setIsImporting(true)
      try {
        await injector.getInstance(StacksApiClient).call({
          method: 'POST',
          action: '/stacks/import',
          body: {
            ...parsed,
            config: { mainDirectory },
          },
        })
        injector.getInstance(NotyService).emit('onNotyAdded', {
          title: 'Stack imported',
          body: `Stack "${parsed.stack.displayName}" was imported successfully.`,
          type: 'success',
        })
        if (autoSetup && (parsed.services?.length ?? 0) > 0) {
          navigate(injector, `/stacks/${parsed.stack.name}/setup`)
        } else {
          navigate(injector, '/')
        }
      } catch (error) {
        injector.getInstance(NotyService).emit('onNotyAdded', {
          title: 'Import failed',
          body: error instanceof Error ? error.message : 'Import error',
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
          {!parsed ? (
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
              {parseError && (
                <div style={{ color: cssVariableTheme.palette.error.main, marginTop: '8px' }}>{parseError}</div>
              )}
              <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '16px' }}>
                <NestedRouteLink href="/">
                  <Button variant="outlined">Cancel</Button>
                </NestedRouteLink>
                <Button variant="contained" disabled={!jsonInput} onclick={handleParse}>
                  Parse
                </Button>
              </div>
            </Paper>
          ) : (
            <Paper elevation={1} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <h3 style={{ margin: '0' }}>Import: {parsed.stack.displayName}</h3>
              <div style={{ display: 'flex', gap: '24px', flexWrap: 'wrap' }}>
                <span>{parsed.services?.length ?? 0} service(s)</span>
                <span>{parsed.repositories?.length ?? 0} repository(ies)</span>
                <span>{parsed.dependencies?.length ?? 0} dependency(ies)</span>
              </div>

              <Input
                name="mainDirectory"
                labelTitle="Main Directory"
                variant="outlined"
                required
                value={mainDirectory}
                getHelperText={() => 'Absolute path to the root directory for this stack on your machine'}
                oninput={(ev) => setMainDirectory((ev.target as HTMLInputElement).value)}
              />

              {(parsed.services?.length ?? 0) > 0 ? (
                <label
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    cursor: 'pointer',
                    fontSize: '14px',
                    color: cssVariableTheme.text.secondary,
                  }}
                >
                  <input
                    type="checkbox"
                    checked={autoSetup}
                    onchange={(ev) => setAutoSetup((ev.target as HTMLInputElement).checked)}
                  />
                  Set up services after import (clone repositories, install dependencies, build)
                </label>
              ) : null}

              <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                <Button
                  variant="outlined"
                  onclick={() => {
                    setParsed(null)
                    setMainDirectory('')
                  }}
                >
                  Back
                </Button>
                <Button
                  variant="contained"
                  disabled={!mainDirectory || isImporting}
                  onclick={() => void handleImport()}
                >
                  Import
                </Button>
              </div>
            </Paper>
          )}
        </Paper>
      </PageContainer>
    )
  },
})
