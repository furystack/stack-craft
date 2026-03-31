import { useCollectionSync } from '@furystack/entity-sync-client'
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
import type { EnvironmentVariableValue, Prerequisite } from 'common'
import { Prerequisite as PrerequisiteModel } from 'common'

import { PrerequisitesApiClient } from '../services/api-clients/prerequisites-api-client.js'
import { EnvironmentVariableService } from '../services/environment-variable-service.js'

type EnvironmentVariablesManagerProps = {
  stackName: string
  environmentVariables: Record<string, EnvironmentVariableValue>
  onSave: (updated: Record<string, EnvironmentVariableValue>) => void
}

type AddVarFormState = {
  variableName: string
  mode: 'requirement' | 'custom'
  prereqName: string
  isSensitive: boolean
  source: 'inherit' | 'custom'
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

    if (Object.keys(editState).length === 0 && Object.keys(props.environmentVariables).length > 0) {
      setEditState(props.environmentVariables)
    }

    const [isSaving, setIsSaving] = useState('isSaving', false)
    const [touchedSensitive, setTouchedSensitive] = useState<Set<string>>('touchedSensitive', new Set())
    const [isAddFormOpen, setIsAddFormOpen] = useState('isAddFormOpen', false)
    const [addFormState, setAddFormState] = useState<AddVarFormState>('addFormState', { ...defaultAddFormState })
    const [isAddingVar, setIsAddingVar] = useState('isAddingVar', false)

    const prereqVarNames = new Set(envPrereqs.map((p) => (p.config as { variableName: string }).variableName))
    const freeFormKeys = Object.keys(editState).filter((k) => !prereqVarNames.has(k))

    if (envPrereqs.length > 0 && !hasChecked) {
      const varNames = [...prereqVarNames]
      void injector
        .getInstance(EnvironmentVariableService)
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
        const toSave = injector.getInstance(EnvironmentVariableService).buildSavePayload(editState, touchedSensitive)
        props.onSave(toSave)
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
          await injector.getInstance(PrerequisitesApiClient).call({
            method: 'POST',
            action: '/prerequisites',
            body: {
              id: newId,
              stackName: props.stackName,
              name: prereqName || variableName,
              type: 'env-variable',
              config: { variableName, ...(isSensitive ? { isSensitive: true } : {}) },
              installationHelp: '',
            },
          })
          injector.getInstance(NotyService).emit('onNotyAdded', {
            title: 'Prerequisite created',
            body: `Environment variable requirement "${variableName}" was added.`,
            type: 'success',
          })
        }

        setEditState({
          ...editState,
          [variableName]: {
            source,
            ...(source === 'custom' ? { customValue } : {}),
            ...(isSensitive ? { isSensitive: true } : {}),
          },
        })

        setAddFormState({ ...defaultAddFormState })
        setIsAddFormOpen(false)
      } catch (error) {
        injector.getInstance(NotyService).emit('onNotyAdded', {
          title: 'Error',
          body: error instanceof Error ? error.message : 'Failed to add environment variable',
          type: 'error',
        })
      } finally {
        setIsAddingVar(false)
      }
    }

    const hasAnyVars = envPrereqs.length > 0 || freeFormKeys.length > 0

    const renderEnvVarRow = (
      varName: string,
      opts: { prereqName?: string; isFreeForm: boolean; defaultSensitive: boolean },
    ) => {
      const isSensitive = editState[varName]?.isSensitive ?? opts.defaultSensitive
      const current = editState[varName]
      const isGloballyAvailable = envAvailability[varName] ?? false
      const source = current?.source ?? (isGloballyAvailable ? 'inherit' : 'custom')

      return (
        <Paper
          elevation={0}
          data-testid={`env-var-${varName}`}
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
            {opts.prereqName ? (
              <span style={{ opacity: '0.6', fontSize: cssVariableTheme.typography.fontSize.sm }}>
                ({opts.prereqName})
              </span>
            ) : null}
            {opts.isFreeForm ? (
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
            ) : null}
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
            ) : !opts.isFreeForm ? (
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
            ) : null}
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
                  [varName]: { source: newSource, customValue: current?.customValue, isSensitive },
                })
              }}
            />
            {source === 'custom' ? (
              <Input
                variant="outlined"
                labelTitle="Value"
                type={isSensitive ? 'password' : 'text'}
                value={current?.customValue ?? ''}
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
            {opts.isFreeForm ? (
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
            ) : null}
          </div>
        </Paper>
      )
    }

    return (
      <Paper elevation={1} style={{ display: 'flex', flexDirection: 'column', gap: '12px', padding: '16px' }}>
        <strong style={{ fontSize: cssVariableTheme.typography.fontSize.lg }}>Environment Variables</strong>
        {!hasAnyVars && !isAddFormOpen ? (
          <p style={{ opacity: '0.6', margin: '0' }}>No environment variables defined for this stack. Add one below.</p>
        ) : null}
        {envPrereqs.map((prereq) => {
          const varName = (prereq.config as { variableName: string }).variableName
          return renderEnvVarRow(varName, {
            prereqName: prereq.name,
            isFreeForm: false,
            defaultSensitive: (prereq.config as { isSensitive?: boolean }).isSensitive ?? false,
          })
        })}
        {freeFormKeys.map((varName) =>
          renderEnvVarRow(varName, { isFreeForm: true, defaultSensitive: editState[varName]?.isSensitive ?? false }),
        )}
        {isAddFormOpen ? (
          <Paper
            elevation={0}
            data-testid="add-env-var-form"
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
            data-testid="add-env-var-button"
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
              loading={isSaving}
              onclick={() => void handleSave()}
              startIcon={<Icon icon={icons.check} size="small" />}
            >
              Save Environment Variables
            </Button>
          </div>
        ) : null}
      </Paper>
    )
  },
})
