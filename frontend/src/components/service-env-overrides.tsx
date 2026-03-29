import { createComponent, Shade } from '@furystack/shades'

import { Button, cssVariableTheme, Icon, icons, Input, Paper, Select } from '@furystack/shades-common-components'
import type { EnvironmentVariableValue, Prerequisite, ServiceView } from 'common'

import { ServicesApiClient } from '../services/api-clients/services-api-client.js'
import { SystemApiClient } from '../services/api-clients/system-api-client.js'

type ServiceEnvOverridesProps = {
  service: ServiceView
  envPrereqs: Prerequisite[]
  stackEnvVars: Record<string, EnvironmentVariableValue>
}

export const ServiceEnvOverrides = Shade<ServiceEnvOverridesProps>({
  customElementName: 'shade-service-env-overrides',
  render: ({ props, injector, useState }) => {
    const { service, envPrereqs, stackEnvVars } = props

    const [envAvailability, setEnvAvailability] = useState<Record<string, boolean>>('envAvailability', {})
    const [hasChecked, setHasChecked] = useState('hasChecked', false)
    const [editState, setEditState] = useState<Record<string, EnvironmentVariableValue>>(
      'editState',
      service.environmentVariableOverrides ?? {},
    )
    const [isSaving, setIsSaving] = useState('isSaving', false)
    const [touchedSensitive, setTouchedSensitive] = useState<Set<string>>('touchedSensitive', new Set())

    if (envPrereqs.length === 0) return <div />

    if (!hasChecked) {
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

    const handleSave = async () => {
      setIsSaving(true)
      try {
        const toSave: Record<string, EnvironmentVariableValue> = {}
        for (const [key, val] of Object.entries(editState)) {
          if (val.isSensitive && val.source === 'custom' && !touchedSensitive.has(key)) {
            toSave[key] = { ...val, customValue: '__UNCHANGED__' }
          } else {
            toSave[key] = val
          }
        }
        await injector.getInstance(ServicesApiClient).call({
          method: 'PATCH',
          action: '/services/:id',
          url: { id: service.id },
          body: { environmentVariableOverrides: toSave },
        })
      } finally {
        setIsSaving(false)
      }
    }

    return (
      <Paper elevation={1} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        <h3 style={{ margin: '0' }}>Environment Variable Overrides</h3>
        <p style={{ margin: '0', opacity: '0.7', fontSize: cssVariableTheme.typography.fontSize.sm }}>
          Override stack-level environment variable values for this service. Leave unset to use the stack default.
        </p>
        {envPrereqs.map((prereq) => {
          const varName = (prereq.config as { variableName: string }).variableName
          const stackValue = stackEnvVars[varName]
          const override = editState[varName]
          const isSensitive =
            override?.isSensitive ??
            stackValue?.isSensitive ??
            (prereq.config as { isSensitive?: boolean }).isSensitive ??
            false
          const isGloballyAvailable = envAvailability[varName] ?? false
          const hasOverride = override !== undefined

          const effectiveSource =
            override?.source ?? stackValue?.source ?? (isGloballyAvailable ? 'inherit' : undefined)

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
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                <strong style={{ fontFamily: 'monospace' }}>{varName}</strong>
                {isSensitive ? <Icon icon={icons.lock} size="small" title="Sensitive value" /> : null}
                <span style={{ opacity: '0.6', fontSize: cssVariableTheme.typography.fontSize.sm }}>
                  ({prereq.name})
                </span>
                {stackValue ? (
                  <span
                    style={{
                      fontSize: cssVariableTheme.typography.fontSize.xs,
                      padding: '2px 6px',
                      borderRadius: '4px',
                      background: cssVariableTheme.palette.info.main,
                      color: cssVariableTheme.palette.info.mainContrast,
                    }}
                  >
                    Stack default: {stackValue.source === 'inherit' ? 'inherit' : 'custom'}
                  </span>
                ) : null}
                {hasOverride ? (
                  <span
                    style={{
                      fontSize: cssVariableTheme.typography.fontSize.xs,
                      padding: '2px 6px',
                      borderRadius: '4px',
                      background: cssVariableTheme.palette.warning.main,
                      color: cssVariableTheme.palette.warning.mainContrast,
                    }}
                  >
                    Overridden
                  </span>
                ) : null}
              </div>
              <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
                <Select
                  variant="outlined"
                  labelTitle="Source"
                  value={!hasOverride ? '' : (effectiveSource ?? '')}
                  options={[
                    { value: '', label: 'Use stack default' },
                    ...(isGloballyAvailable ? [{ value: 'inherit', label: 'Inherit from system' }] : []),
                    { value: 'custom', label: 'Custom value' },
                  ]}
                  onchange={(ev) => {
                    const val = (ev.target as HTMLSelectElement).value
                    if (val === '') {
                      const next = { ...editState }
                      delete next[varName]
                      setEditState(next)
                    } else {
                      setEditState({
                        ...editState,
                        [varName]: {
                          source: val as 'inherit' | 'custom',
                          customValue: override?.customValue,
                          isSensitive,
                        },
                      })
                    }
                  }}
                />
                {hasOverride && override.source === 'custom' ? (
                  <Input
                    variant="outlined"
                    labelTitle="Value"
                    type={isSensitive ? 'password' : 'text'}
                    value={override.customValue ?? ''}
                    placeholder="Enter value..."
                    style={{ flex: '1', fontFamily: 'monospace' }}
                    oninput={(ev) => {
                      if (isSensitive) {
                        setTouchedSensitive(new Set([...touchedSensitive, varName]))
                      }
                      setEditState({
                        ...editState,
                        [varName]: {
                          source: 'custom',
                          customValue: (ev.target as HTMLInputElement).value,
                          isSensitive,
                        },
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
            Save Overrides
          </Button>
        </div>
      </Paper>
    )
  },
})
