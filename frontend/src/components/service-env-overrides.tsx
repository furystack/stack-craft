import { createComponent, Shade } from '@furystack/shades'

import {
  Button,
  Checkbox,
  cssVariableTheme,
  Icon,
  icons,
  Input,
  NotyService,
  Paper,
  Select,
} from '@furystack/shades-common-components'
import type { EnvironmentVariableValue, Prerequisite, ServiceView } from 'common'

import { PrerequisitesApiClient } from '../services/api-clients/prerequisites-api-client.js'
import { ServicesApiClient } from '../services/api-clients/services-api-client.js'
import { EnvironmentVariableService } from '../services/environment-variable-service.js'

type ServiceEnvOverridesProps = {
  service: ServiceView
  envPrereqs: Prerequisite[]
  stackEnvVars: Record<string, EnvironmentVariableValue>
}

type AddVarFormState = {
  variableName: string
  mode: 'requirement' | 'custom'
  prereqName: string
  isSensitive: boolean
  source: '' | 'inherit' | 'custom'
  customValue: string
}

const defaultAddFormState: AddVarFormState = {
  variableName: '',
  mode: 'custom',
  prereqName: '',
  isSensitive: false,
  source: 'custom',
  customValue: '',
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
    const [isAddFormOpen, setIsAddFormOpen] = useState('isAddFormOpen', false)
    const [addFormState, setAddFormState] = useState<AddVarFormState>('addFormState', { ...defaultAddFormState })
    const [isAddingVar, setIsAddingVar] = useState('isAddingVar', false)

    const prereqVarNames = new Set(envPrereqs.map((p) => (p.config as { variableName: string }).variableName))
    const freeFormKeys = Object.keys(editState).filter((k) => !prereqVarNames.has(k))
    const hasAnyVars = envPrereqs.length > 0 || freeFormKeys.length > 0

    if (envPrereqs.length > 0 && !hasChecked) {
      const varNames = [...prereqVarNames]
      void injector
        .get(EnvironmentVariableService)
        .checkAvailability(varNames)
        .then((result) => {
          setEnvAvailability(result)
          setHasChecked(true)
        })
        .catch(() => setHasChecked(true))
    }

    const handleSave = async () => {
      setIsSaving(true)
      try {
        const toSave = injector.get(EnvironmentVariableService).buildSavePayload(editState, touchedSensitive)
        await injector.get(ServicesApiClient).call({
          method: 'PATCH',
          action: '/services/:id',
          url: { id: service.id },
          body: { environmentVariableOverrides: toSave },
        })
        injector.get(NotyService).emit('onNotyAdded', {
          title: 'Overrides saved',
          body: 'Service environment variable overrides were updated.',
          type: 'success',
        })
      } catch (error) {
        injector.get(NotyService).emit('onNotyAdded', {
          title: 'Error',
          body: error instanceof Error ? error.message : 'Failed to save overrides',
          type: 'error',
        })
      } finally {
        setIsSaving(false)
      }
    }

    const handleAddVariable = async () => {
      const { variableName, mode, prereqName, isSensitive, source, customValue } = addFormState
      if (!variableName.trim()) return

      setIsAddingVar(true)
      try {
        if (mode === 'requirement') {
          const newId = crypto.randomUUID()
          await injector.get(PrerequisitesApiClient).call({
            method: 'POST',
            action: '/prerequisites',
            body: {
              id: newId,
              stackName: service.stackName,
              name: prereqName || variableName,
              type: 'env-variable',
              config: { variableName, ...(isSensitive ? { isSensitive: true } : {}) },
              installationHelp: '',
            },
          })
          await injector.get(ServicesApiClient).call({
            method: 'PATCH',
            action: '/services/:id',
            url: { id: service.id },
            body: { prerequisiteIds: [...(service.prerequisiteIds ?? []), newId] },
          })
          injector.get(NotyService).emit('onNotyAdded', {
            title: 'Prerequisite created',
            body: `Environment variable requirement "${variableName}" was added and linked to this service.`,
            type: 'success',
          })
        }

        if (source) {
          setEditState({
            ...editState,
            [variableName]: {
              source,
              ...(source === 'custom' ? { customValue } : {}),
              ...(isSensitive ? { isSensitive: true } : {}),
            },
          })
        }

        setAddFormState({ ...defaultAddFormState })
        setIsAddFormOpen(false)
      } catch (error) {
        injector.get(NotyService).emit('onNotyAdded', {
          title: 'Error',
          body: error instanceof Error ? error.message : 'Failed to add environment variable',
          type: 'error',
        })
      } finally {
        setIsAddingVar(false)
      }
    }

    return (
      <Paper elevation={1} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        <h3 style={{ margin: '0' }}>Environment Variable Overrides</h3>
        <p style={{ margin: '0', opacity: '0.7', fontSize: cssVariableTheme.typography.fontSize.sm }}>
          Override stack-level environment variable values for this service, or add new variables.
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
              data-testid={`env-override-${varName}`}
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
                  onValueChange={(val) => {
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
        {freeFormKeys.map((varName) => {
          const override = editState[varName]
          const isSensitive = override?.isSensitive ?? false
          const isGloballyAvailable = envAvailability[varName] ?? false

          return (
            <Paper
              elevation={0}
              data-testid={`env-override-${varName}`}
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
                <span
                  style={{
                    fontSize: cssVariableTheme.typography.fontSize.xs,
                    padding: '2px 6px',
                    borderRadius: '4px',
                    background: cssVariableTheme.palette.secondary.main,
                    color: cssVariableTheme.palette.secondary.mainContrast,
                  }}
                >
                  Custom
                </span>
              </div>
              <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
                <Select
                  variant="outlined"
                  labelTitle="Source"
                  value={override?.source ?? 'custom'}
                  options={[
                    ...(isGloballyAvailable ? [{ value: 'inherit', label: 'Inherit from system' }] : []),
                    { value: 'custom', label: 'Custom value' },
                  ]}
                  onchange={(ev) => {
                    const newSource = (ev.target as HTMLSelectElement).value as 'inherit' | 'custom'
                    setEditState({
                      ...editState,
                      [varName]: { source: newSource, customValue: override?.customValue, isSensitive },
                    })
                  }}
                />
                {override?.source === 'custom' ? (
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
                <Button
                  variant="outlined"
                  color="error"
                  size="small"
                  title="Remove variable"
                  onclick={() => {
                    const next = { ...editState }
                    delete next[varName]
                    setEditState(next)
                  }}
                  startIcon={<Icon icon={icons.trash} size="small" />}
                >
                  Remove
                </Button>
              </div>
            </Paper>
          )
        })}
        {isAddFormOpen ? (
          <Paper
            elevation={0}
            data-testid="add-env-override-form"
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '12px',
              padding: '12px',
              border: `1px solid ${cssVariableTheme.palette.primary.main}`,
              borderRadius: cssVariableTheme.shape.borderRadius.md,
            }}
          >
            <strong>Add Environment Variable</strong>
            <Select
              variant="outlined"
              labelTitle="Mode"
              value={addFormState.mode}
              options={[
                { value: 'custom', label: 'Custom only (local)' },
                { value: 'requirement', label: 'Requirement (creates prerequisite)' },
              ]}
              onchange={(ev) =>
                setAddFormState({
                  ...addFormState,
                  mode: (ev.target as HTMLSelectElement).value as 'requirement' | 'custom',
                })
              }
            />
            <Input
              variant="outlined"
              labelTitle="Variable Name"
              required
              placeholder="e.g. GITHUB_TOKEN"
              value={addFormState.variableName}
              style={{ fontFamily: 'monospace' }}
              oninput={(ev) =>
                setAddFormState({ ...addFormState, variableName: (ev.target as HTMLInputElement).value })
              }
            />
            {addFormState.mode === 'requirement' ? (
              <Input
                variant="outlined"
                labelTitle="Display Name"
                placeholder="e.g. GitHub Token"
                value={addFormState.prereqName}
                getHelperText={() => 'Human-readable name for the prerequisite'}
                oninput={(ev) =>
                  setAddFormState({ ...addFormState, prereqName: (ev.target as HTMLInputElement).value })
                }
              />
            ) : null}
            <Checkbox
              labelTitle="Sensitive value (encrypt at rest and mask in API responses)"
              checked={addFormState.isSensitive}
              onchange={(ev) =>
                setAddFormState({ ...addFormState, isSensitive: (ev.target as HTMLInputElement).checked })
              }
            />
            <Select
              variant="outlined"
              labelTitle="Source"
              value={addFormState.source}
              options={[
                { value: 'inherit', label: 'Inherit from system' },
                { value: 'custom', label: 'Custom value' },
              ]}
              onchange={(ev) =>
                setAddFormState({
                  ...addFormState,
                  source: (ev.target as HTMLSelectElement).value as 'inherit' | 'custom',
                })
              }
            />
            {addFormState.source === 'custom' ? (
              <Input
                variant="outlined"
                labelTitle="Value"
                type={addFormState.isSensitive ? 'password' : 'text'}
                placeholder="Enter value..."
                value={addFormState.customValue}
                style={{ fontFamily: 'monospace' }}
                oninput={(ev) =>
                  setAddFormState({ ...addFormState, customValue: (ev.target as HTMLInputElement).value })
                }
              />
            ) : null}
            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
              <Button
                variant="outlined"
                onclick={() => {
                  setAddFormState({ ...defaultAddFormState })
                  setIsAddFormOpen(false)
                }}
                startIcon={<Icon icon={icons.close} size="small" />}
              >
                Cancel
              </Button>
              <Button
                variant="contained"
                loading={isAddingVar}
                disabled={!addFormState.variableName.trim()}
                onclick={() => void handleAddVariable()}
                startIcon={<Icon icon={icons.plus} size="small" />}
              >
                Add
              </Button>
            </div>
          </Paper>
        ) : (
          <Button
            variant="outlined"
            data-testid="add-env-override-button"
            onclick={() => setIsAddFormOpen(true)}
            startIcon={<Icon icon={icons.plus} size="small" />}
            style={{ alignSelf: 'flex-start' }}
          >
            Add Variable
          </Button>
        )}
        {hasAnyVars ? (
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <Button
              variant="contained"
              data-testid="save-env-overrides"
              loading={isSaving}
              onclick={() => void handleSave()}
              startIcon={<Icon icon={icons.check} size="small" />}
            >
              Save Overrides
            </Button>
          </div>
        ) : null}
      </Paper>
    )
  },
})
