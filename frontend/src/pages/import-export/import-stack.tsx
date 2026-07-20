import { createComponent, Shade } from '@furystack/shades'

import {
  Button,
  Checkbox,
  cssVariableTheme,
  Form,
  Icon,
  icons,
  Input,
  NotyService,
  PageContainer,
  PageHeader,
  Paper,
  Switch,
} from '@furystack/shades-common-components'
import type { EnvironmentVariableValue, ExportStackResult } from 'common'

import { stackCraftNavigate, StackCraftNestedRouteLink } from '../../components/app-routes.js'
import { LazyMonacoEditor } from '../../components/lazy-monaco-editor.js'
import { prerequisiteTypeLabels } from '../../components/status-chips.js'
import { StacksApiClient } from '../../services/api-clients/stacks-api-client.js'
import { SystemApiClient } from '../../services/api-clients/system-api-client.js'
import type { EnvVarEntry } from './env-var-config-row.js'
import { EnvVarConfigRow } from './env-var-config-row.js'
import { stackExportSchema } from './stack-export-schema.js'

type ParsedExport = ExportStackResult

type ImportConfigPayload = {
  mainDirectory: string
  autoSetup?: string
  regenerateIds?: string
  [key: `envSource_${string}`]: string
  [key: `envValue_${string}`]: string
}

export const isImportConfigPayload = (data: unknown): data is ImportConfigPayload => {
  const d = data as ImportConfigPayload
  return d.mainDirectory?.length > 0
}

export const ImportStack = Shade({
  customElementName: 'shade-import-stack',
  render: ({ injector, useState }) => {
    const [jsonInput, setJsonInput] = useState('json', '')
    const [parsed, setParsed] = useState<ParsedExport | null>('parsed', null)
    const [parseError, setParseError] = useState('parseError', '')
    const [envVars, setEnvVars] = useState<EnvVarEntry[]>('envVars', [])
    const [envLoading, setEnvLoading] = useState('envLoading', false)

    const handleParse = async () => {
      try {
        const data = JSON.parse(jsonInput) as ParsedExport
        if (!data.stack?.name) {
          setParseError('Invalid export: missing stack name')
          setParsed(null)
          return
        }
        setParsed(data)
        setParseError('')

        const envPrereqs = (data.prerequisites ?? []).filter((p) => p.type === 'env-variable')
        if (envPrereqs.length > 0) {
          setEnvLoading(true)
          try {
            const varNames = envPrereqs.map((p) => (p.config as { variableName: string }).variableName)
            const { result } = await injector.get(SystemApiClient).call({
              method: 'POST',
              action: '/system/check-env-availability',
              body: { variableNames: varNames },
            })
            setEnvVars(
              envPrereqs.map((p) => {
                const varName = (p.config as { variableName: string }).variableName
                return {
                  variableName: varName,
                  prerequisiteName: p.name,
                  availableGlobally: result[varName] ?? false,
                }
              }),
            )
          } catch {
            setEnvVars(
              envPrereqs.map((p) => ({
                variableName: (p.config as { variableName: string }).variableName,
                prerequisiteName: p.name,
                availableGlobally: false,
              })),
            )
          } finally {
            setEnvLoading(false)
          }
        }
      } catch {
        setParseError('Invalid JSON')
        setParsed(null)
      }
    }

    const handleImport = async (formData: ImportConfigPayload) => {
      if (!parsed) return

      const environmentVariables: Record<string, EnvironmentVariableValue> = {}
      for (const entry of envVars) {
        const source = formData[`envSource_${entry.variableName}`] as 'inherit' | 'custom' | undefined
        if (source === 'custom') {
          environmentVariables[entry.variableName] = {
            source: 'custom',
            customValue: formData[`envValue_${entry.variableName}`] ?? '',
          }
        } else {
          environmentVariables[entry.variableName] = { source: 'inherit' }
        }
      }

      try {
        await injector.get(StacksApiClient).call({
          method: 'POST',
          action: '/stacks/import',
          body: {
            ...parsed,
            config: {
              mainDirectory: formData.mainDirectory,
              ...(Object.keys(environmentVariables).length > 0 ? { environmentVariables } : {}),
            },
            ...(formData.regenerateIds === 'on' ? { regenerateIds: true } : {}),
          },
        })
        injector.get(NotyService).emit('onNotyAdded', {
          title: 'Stack imported',
          body: `Stack "${parsed.stack.displayName}" was imported successfully.`,
          type: 'success',
        })
        const hasAutoSetup = formData.autoSetup === 'on'
        if (hasAutoSetup && (parsed.services?.length ?? 0) > 0) {
          stackCraftNavigate(injector, {
            path: '/stacks/:stackName/services',
            params: { stackName: parsed.stack.name },
          })
        } else {
          stackCraftNavigate(injector, {
            path: '/stacks/:stackName/services',
            params: { stackName: parsed.stack.name },
          })
        }
      } catch (error) {
        injector.get(NotyService).emit('onNotyAdded', {
          title: 'Import failed',
          body: error instanceof Error ? error.message : 'Import error',
          type: 'error',
        })
      }
    }

    return (
      <PageContainer>
        <PageHeader
          icon="📥"
          title="Import Stack"
          description="Paste the exported JSON data below to import a stack with all its services, repositories, and prerequisites."
        />
        <Paper>
          {!parsed ? (
            <Paper elevation={1} style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div style={{ height: '400px', border: `1px solid ${cssVariableTheme.divider}`, borderRadius: '4px' }}>
                <LazyMonacoEditor
                  value={jsonInput}
                  language="json"
                  schemaInfo={{ schemaName: 'ExportStackResult', jsonSchema: stackExportSchema }}
                  onValueChange={(value) => setJsonInput(value)}
                />
              </div>
              {parseError && (
                <div style={{ color: cssVariableTheme.palette.error.main, marginTop: '8px' }}>{parseError}</div>
              )}
              <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '16px' }}>
                <StackCraftNestedRouteLink path="/">
                  <Button variant="outlined" startIcon={<Icon icon={icons.close} size="small" />}>
                    Cancel
                  </Button>
                </StackCraftNestedRouteLink>
                <Button
                  variant="contained"
                  disabled={!jsonInput}
                  onclick={() => void handleParse()}
                  startIcon={<Icon icon={icons.check} size="small" />}
                >
                  Parse
                </Button>
              </div>
            </Paper>
          ) : (
            <Form<ImportConfigPayload> validate={isImportConfigPayload} onSubmit={handleImport} disableOnSubmit>
              <Paper elevation={1} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <h3 style={{ margin: '0' }}>Import: {parsed.stack.displayName}</h3>
                <div style={{ display: 'flex', gap: '24px', flexWrap: 'wrap' }}>
                  <span>{parsed.services?.length ?? 0} service(s)</span>
                  <span>{parsed.repositories?.length ?? 0} repository(ies)</span>
                  <span>{parsed.prerequisites?.length ?? 0} prerequisite(s)</span>
                </div>

                {(parsed.prerequisites?.length ?? 0) > 0 ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '13px' }}>
                    <strong style={{ fontSize: '14px' }}>Prerequisites:</strong>
                    {parsed.prerequisites.map((p) => (
                      <div
                        style={{
                          display: 'flex',
                          gap: '8px',
                          alignItems: 'center',
                          padding: '4px 8px',
                          borderRadius: '4px',
                          border: `1px solid ${cssVariableTheme.divider}`,
                        }}
                      >
                        <span style={{ fontWeight: '500' }}>{p.name}</span>
                        <span style={{ opacity: '0.6' }}>{prerequisiteTypeLabels[p.type] ?? p.type}</span>
                      </div>
                    ))}
                  </div>
                ) : null}

                <Input
                  name="mainDirectory"
                  labelTitle="Main Directory"
                  variant="outlined"
                  required
                  getHelperText={() => 'Absolute path to the root directory for this stack on your machine'}
                />

                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <Switch name="regenerateIds" labelTitle="Import as duplicate (generate new IDs)" checked={false} />
                  <span style={{ fontSize: '12px', opacity: '0.7', marginLeft: '28px' }}>
                    Enable when importing a copy of a stack that already exists on this machine. Services, repositories
                    and prerequisites get fresh IDs so they don't collide with the source stack.
                  </span>
                </div>

                {envVars.length > 0 && !envLoading ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    <strong style={{ fontSize: '14px' }}>Environment Variables:</strong>
                    {envVars.map((entry) => (
                      <EnvVarConfigRow entry={entry} />
                    ))}
                  </div>
                ) : null}

                {envLoading ? (
                  <div style={{ opacity: '0.6', fontSize: '13px' }}>Checking environment variables...</div>
                ) : null}

                {(parsed.services?.length ?? 0) > 0 ? (
                  <Checkbox
                    name="autoSetup"
                    labelTitle="Set up services after import (clone repositories, install, build)"
                    checked={true}
                  />
                ) : null}

                <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                  <Button
                    variant="outlined"
                    onclick={() => {
                      setParsed(null)
                      setEnvVars([])
                    }}
                    startIcon={<Icon icon={icons.chevronLeft} size="small" />}
                  >
                    Back
                  </Button>
                  <Button type="submit" variant="contained" startIcon={<Icon icon={icons.upload} size="small" />}>
                    Import
                  </Button>
                </div>
              </Paper>
            </Form>
          )}
        </Paper>
      </PageContainer>
    )
  },
})
