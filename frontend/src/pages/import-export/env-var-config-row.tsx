import { createComponent, Shade } from '@furystack/shades'
import { cssVariableTheme, Input, Paper, Select } from '@furystack/shades-common-components'

export type EnvVarEntry = {
  variableName: string
  prerequisiteName: string
  availableGlobally: boolean
}

type EnvVarConfigRowProps = {
  entry: EnvVarEntry
}

export const EnvVarConfigRow = Shade<EnvVarConfigRowProps>({
  customElementName: 'shade-env-var-config-row',
  render: ({ props, useState }) => {
    const { entry } = props
    const defaultSource = entry.availableGlobally ? 'inherit' : 'custom'
    const [source, setSource] = useState<'inherit' | 'custom'>('source', defaultSource)

    return (
      <Paper
        elevation={0}
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '8px',
          padding: '12px',
          border: `1px solid ${cssVariableTheme.divider}`,
          borderRadius: cssVariableTheme.shape.borderRadius.md,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <strong style={{ fontFamily: 'monospace' }}>{entry.variableName}</strong>
          <span style={{ opacity: '0.6', fontSize: '12px' }}>({entry.prerequisiteName})</span>
          {entry.availableGlobally ? (
            <span
              style={{
                fontSize: '11px',
                padding: '2px 6px',
                borderRadius: '4px',
                background: cssVariableTheme.palette.success.main,
                color: cssVariableTheme.palette.success.mainContrast,
              }}
            >
              Available in system
            </span>
          ) : (
            <span
              style={{
                fontSize: '11px',
                padding: '2px 6px',
                borderRadius: '4px',
                background: cssVariableTheme.palette.warning.main,
                color: cssVariableTheme.palette.warning.mainContrast,
              }}
            >
              Not found in system
            </span>
          )}
        </div>
        <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
          <Select
            name={`envSource_${entry.variableName}`}
            labelTitle="Source"
            variant="outlined"
            options={[
              ...(entry.availableGlobally ? [{ value: 'inherit', label: 'Inherit from system' }] : []),
              { value: 'custom', label: 'Custom value' },
            ]}
            value={defaultSource}
            onchange={(ev) => {
              setSource((ev.target as HTMLSelectElement).value as 'inherit' | 'custom')
            }}
          />
          {source === 'custom' ? (
            <Input
              name={`envValue_${entry.variableName}`}
              labelTitle="Value"
              variant="outlined"
              required
              style={{ flex: '1' }}
            />
          ) : null}
        </div>
      </Paper>
    )
  },
})
