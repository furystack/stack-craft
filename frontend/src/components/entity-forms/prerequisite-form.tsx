import { createComponent, Shade } from '@furystack/shades'
import { Button, Form, Icon, icons, Input, MarkdownInput, Select } from '@furystack/shades-common-components'
import type { Prerequisite, PrerequisiteConfig, PrerequisiteType } from 'common'

type PrerequisiteFormPayload = {
  name: string
  type: PrerequisiteType
  minimumVersion?: string
  version?: string
  feedUrl?: string
  feedName?: string
  variableName?: string
  script?: string
  installationHelp?: string
}

const TYPES_REQUIRING_MINIMUM_VERSION: PrerequisiteType[] = ['node', 'yarn']
const TYPES_REQUIRING_VERSION: PrerequisiteType[] = ['dotnet-sdk', 'dotnet-runtime']

const isPrerequisiteFormPayload = (data: unknown): data is PrerequisiteFormPayload => {
  const d = data as PrerequisiteFormPayload
  if (!d.name || d.name.length === 0) return false
  if (!d.type || d.type.length === 0) return false

  if (TYPES_REQUIRING_MINIMUM_VERSION.includes(d.type) && (!d.minimumVersion || d.minimumVersion.length === 0)) {
    return false
  }
  if (TYPES_REQUIRING_VERSION.includes(d.type) && (!d.version || d.version.length === 0)) {
    return false
  }
  if (d.type === 'nuget-feed' && (!d.feedUrl || d.feedUrl.length === 0)) return false
  if (d.type === 'env-variable' && (!d.variableName || d.variableName.length === 0)) return false
  if (d.type === 'custom-script' && (!d.script || d.script.length === 0)) return false

  return true
}

const buildConfig = (data: PrerequisiteFormPayload): PrerequisiteConfig => {
  switch (data.type) {
    case 'node':
    case 'yarn':
      return { minimumVersion: data.minimumVersion! } as PrerequisiteConfig
    case 'dotnet-sdk':
    case 'dotnet-runtime':
      return { version: data.version! } as PrerequisiteConfig
    case 'nuget-feed':
      return { feedUrl: data.feedUrl!, ...(data.feedName ? { feedName: data.feedName } : {}) } as PrerequisiteConfig
    case 'git':
    case 'github-cli':
      return {} as PrerequisiteConfig
    case 'env-variable':
      return { variableName: data.variableName! } as PrerequisiteConfig
    case 'custom-script':
      return { script: data.script! } as PrerequisiteConfig
    default:
      return {} as PrerequisiteConfig
  }
}

const extractConfigField = (config: PrerequisiteConfig | undefined, field: string): string => {
  if (!config || typeof config !== 'object') return ''
  return (config as Record<string, string>)[field] ?? ''
}

const typeOptions = [
  { value: 'node', label: 'Node.js' },
  { value: 'yarn', label: 'Yarn' },
  { value: 'dotnet-sdk', label: '.NET SDK' },
  { value: 'dotnet-runtime', label: '.NET Runtime' },
  { value: 'nuget-feed', label: 'NuGet Feed' },
  { value: 'git', label: 'Git' },
  { value: 'github-cli', label: 'GitHub CLI (gh)' },
  { value: 'env-variable', label: 'Environment Variable' },
  { value: 'custom-script', label: 'Custom Script' },
]

type PrerequisiteFormProps = {
  initial?: Partial<Prerequisite>
  stackName: string
  onSubmit: (data: Partial<Prerequisite>) => void | Promise<void>
  onCancel: () => void
  mode: 'create' | 'edit'
}

export const PrerequisiteForm = Shade<PrerequisiteFormProps>({
  customElementName: 'shade-prerequisite-form',
  render: ({ props, useState }) => {
    const [selectedType, setSelectedType] = useState<PrerequisiteType | ''>('selectedType', props.initial?.type ?? '')

    return (
      <Form<PrerequisiteFormPayload>
        validate={isPrerequisiteFormPayload}
        onSubmit={(data) =>
          props.onSubmit({
            stackName: props.stackName,
            name: data.name,
            type: data.type,
            config: buildConfig(data),
            installationHelp: data.installationHelp ?? '',
          })
        }
        disableOnSubmit
        style={{ display: 'flex', flexDirection: 'column', gap: '16px', maxWidth: '600px' }}
      >
        <h2 style={{ margin: '0' }}>{props.mode === 'create' ? 'Add Prerequisite' : 'Edit Prerequisite'}</h2>
        <Input
          name="name"
          labelTitle="Name"
          variant="outlined"
          required
          value={props.initial?.name ?? ''}
          getHelperText={() => 'Human-readable name (e.g., "Node.js >= 18")'}
        />
        <Select
          name="type"
          labelTitle="Type"
          variant="outlined"
          required
          options={typeOptions}
          value={props.initial?.type ?? ''}
          placeholder="Select a prerequisite type..."
          onValueChange={(value) => setSelectedType(value as PrerequisiteType)}
        />

        {(selectedType === 'node' || selectedType === 'yarn') && (
          <Input
            name="minimumVersion"
            labelTitle="Minimum Version"
            variant="outlined"
            required
            value={extractConfigField(props.initial?.config, 'minimumVersion')}
            getHelperText={() => 'Semver version (e.g., "18.0.0", "4.0.0")'}
          />
        )}

        {(selectedType === 'dotnet-sdk' || selectedType === 'dotnet-runtime') && (
          <Input
            name="version"
            labelTitle="Version"
            variant="outlined"
            required
            value={extractConfigField(props.initial?.config, 'version')}
            getHelperText={() => 'Exact version prefix (e.g., "8.0", "9.0.100")'}
          />
        )}

        {selectedType === 'nuget-feed' && (
          <div style={{ display: 'contents' }}>
            <Input
              name="feedUrl"
              labelTitle="Feed URL"
              variant="outlined"
              required
              value={extractConfigField(props.initial?.config, 'feedUrl')}
              getHelperText={() => 'The NuGet feed URL to check for'}
            />
            <Input
              name="feedName"
              labelTitle="Feed Name"
              variant="outlined"
              value={extractConfigField(props.initial?.config, 'feedName')}
              getHelperText={() => 'Optional display name for the feed'}
            />
          </div>
        )}

        {selectedType === 'env-variable' && (
          <Input
            name="variableName"
            labelTitle="Variable Name"
            variant="outlined"
            required
            value={extractConfigField(props.initial?.config, 'variableName')}
            getHelperText={() => 'The environment variable name to check (e.g., "GITHUB_TOKEN")'}
          />
        )}

        {selectedType === 'custom-script' && (
          <Input
            name="script"
            labelTitle="Script"
            variant="outlined"
            required
            value={extractConfigField(props.initial?.config, 'script')}
            getHelperText={() => 'Shell script that returns exit code 0 if satisfied'}
          />
        )}

        <MarkdownInput
          name="installationHelp"
          labelTitle="Installation Help"
          value={props.initial?.installationHelp ?? ''}
          rows={4}
          getHelperText={() => 'Instructions shown when the check fails'}
        />
        <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
          <Button variant="outlined" onclick={props.onCancel} startIcon={<Icon icon={icons.close} size="small" />}>
            Cancel
          </Button>
          <Button
            type="submit"
            variant="contained"
            startIcon={<Icon icon={props.mode === 'create' ? icons.plus : icons.save} size="small" />}
          >
            {props.mode === 'create' ? 'Add' : 'Save'}
          </Button>
        </div>
      </Form>
    )
  },
})
