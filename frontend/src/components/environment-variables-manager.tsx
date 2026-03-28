import { useCollectionSync } from '@furystack/entity-sync-client'
import { createComponent, Shade } from '@furystack/shades'

import { Button, cssVariableTheme, Icon, icons, Input, Paper, Select } from '@furystack/shades-common-components'
import type { EnvironmentVariableValue, Prerequisite } from 'common'
import { Prerequisite as PrerequisiteModel } from 'common'

import { SystemApiClient } from '../services/api-clients/system-api-client.js'

type EnvironmentVariablesManagerProps = {
  stackName: string
  environmentVariables: Record<string, EnvironmentVariableValue>
  onSave: (updated: Record<string, EnvironmentVariableValue>) => void
}

export const EnvironmentVariablesManager = Shade<EnvironmentVariablesManagerProps>({
  customElementName: 'shade-env-vars-manager',
  render: (options) => {
    const { props, injector, useState } = options

    const prereqsState = useCollectionSync(options, PrerequisiteModel, {
      filter: { stackName: { $eq: props.stackName } },
    })
    const allPrereqs: Prerequisite[] =
      prereqsState.status === 'synced' || prereqsState.status === 'cached' ? prereqsState.data.entries : []
    const envPrereqs = allPrereqs.filter((p) => p.type === 'env-variable')

    const [envAvailability, setEnvAvailability] = useState<Record<string, boolean>>('envAvailability', {})
    const [hasChecked, setHasChecked] = useState('hasChecked', false)
    const [editState, setEditState] = useState<Record<string, EnvironmentVariableValue>>(
      'editState',
      props.environmentVariables,
    )
    const [isSaving, setIsSaving] = useState('isSaving', false)

    if (envPrereqs.length > 0 && !hasChecked) {
      const varNames = envPrereqs.map((p) => (p.config as { variableName: string }).variableName)
      void injector
        .getInstance(SystemApiClient)
        .call({
          method: 'POST',
          action: '/system/check-env-availability',
          body: { variableNames: varNames },
        })
        .then(({ result }) => {
          setEnvAvailability(result)
          setHasChecked(true)
        })
        .catch(() => setHasChecked(true))
    }

    if (envPrereqs.length === 0) {
      return (
        <Paper elevation={1} style={{ padding: '16px' }}>
          <strong>Environment Variables</strong>
          <p style={{ opacity: '0.6', margin: '8px 0 0' }}>
            No environment variable prerequisites defined for this stack.
          </p>
        </Paper>
      )
    }

    const handleSave = async () => {
      setIsSaving(true)
      try {
        props.onSave(editState)
      } finally {
        setIsSaving(false)
      }
    }

    return (
      <Paper elevation={1} style={{ display: 'flex', flexDirection: 'column', gap: '12px', padding: '16px' }}>
        <strong style={{ fontSize: cssVariableTheme.typography.fontSize.lg }}>Environment Variables</strong>
        {envPrereqs.map((prereq) => {
          const varName = (prereq.config as { variableName: string }).variableName
          const current = editState[varName]
          const isGloballyAvailable = envAvailability[varName] ?? false
          const source = current?.source ?? (isGloballyAvailable ? 'inherit' : 'custom')

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
                <strong style={{ fontFamily: 'monospace' }}>{varName}</strong>
                <span style={{ opacity: '0.6', fontSize: cssVariableTheme.typography.fontSize.sm }}>
                  ({prereq.name})
                </span>
                {isGloballyAvailable ? (
                  <span
                    style={{
                      fontSize: cssVariableTheme.typography.fontSize.xs,
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
                      fontSize: cssVariableTheme.typography.fontSize.xs,
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
                  variant="outlined"
                  labelTitle="Source"
                  value={source}
                  options={[
                    ...(isGloballyAvailable ? [{ value: 'inherit', label: 'Inherit from system' }] : []),
                    { value: 'custom', label: 'Custom value' },
                  ]}
                  onchange={(ev) => {
                    const newSource = (ev.target as HTMLSelectElement).value as 'inherit' | 'custom'
                    setEditState({
                      ...editState,
                      [varName]: { source: newSource, customValue: current?.customValue },
                    })
                  }}
                />
                {source === 'custom' ? (
                  <Input
                    variant="outlined"
                    labelTitle="Value"
                    value={current?.customValue ?? ''}
                    placeholder="Enter value..."
                    style={{ flex: '1', fontFamily: 'monospace' }}
                    oninput={(ev) => {
                      setEditState({
                        ...editState,
                        [varName]: { source: 'custom', customValue: (ev.target as HTMLInputElement).value },
                      })
                    }}
                  />
                ) : null}
              </div>
            </Paper>
          )
        })}
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <Button
            variant="contained"
            loading={isSaving}
            onclick={() => void handleSave()}
            startIcon={<Icon icon={icons.check} size="small" />}
          >
            Save Environment Variables
          </Button>
        </div>
      </Paper>
    )
  },
})
