import { createComponent, Shade } from '@furystack/shades'
import {
  Button,
  Checkbox,
  cssVariableTheme,
  Dialog,
  Form,
  Icon,
  icons,
  Input,
  MarkdownEditor,
  Select,
} from '@furystack/shades-common-components'
import type { GitHubRepository, Prerequisite, ServiceFile, ServiceView } from 'common'

import type { StaticAppRoutePath } from '../../app-routes.js'
import { StackCraftNestedRouteLink } from '../../app-routes.js'
import { GitHubRepoForm } from '../github-repo-form.js'
import { PrerequisiteForm } from '../prerequisite-form.js'
import { DependencySelector } from './dependency-selector.js'
import { FileList } from './file-list.js'
import { PrerequisiteSelector } from './prerequisite-selector.js'

export type ServiceFormPayload = {
  displayName: string
  description: string
  workingDirectory: string
  repositoryId: string
  runCommand: string
  installCommand: string
  buildCommand: string
  autoFetchEnabled: string
  autoFetchIntervalMinutes: string
  autoRestartOnFetch: string
}

export const isServiceFormPayload = (data: unknown): data is ServiceFormPayload => {
  const d = data as ServiceFormPayload
  return d.displayName?.length > 0 && d.runCommand?.length > 0
}

type ServiceFormProps = {
  initial?: Partial<ServiceView>
  stackName: string
  repositories?: GitHubRepository[]
  prerequisites?: Prerequisite[]
  otherServices?: Array<{ id: string; displayName: string }>
  onSubmit: (data: Partial<ServiceView>) => void | Promise<void>
  onCreatePrerequisite?: (data: Partial<Prerequisite>) => Promise<string>
  onCreateRepository?: (data: Partial<GitHubRepository>) => Promise<string>
  onCancel?: () => void
  cancelHref?: StaticAppRoutePath
  mode: 'create' | 'edit'
}

export const ServiceForm = Shade<ServiceFormProps>({
  customElementName: 'shade-service-form',
  render: ({ props, useState }) => {
    const [selectedPrereqIds, setSelectedPrereqIds] = useState<string[]>(
      'selectedPrereqIds',
      props.initial?.prerequisiteIds ?? [],
    )
    const [selectedPrereqServiceIds, setSelectedPrereqServiceIds] = useState<string[]>(
      'selectedPrereqServiceIds',
      props.initial?.prerequisiteServiceIds ?? [],
    )
    const [isCreatingPrereq, setIsCreatingPrereq] = useState('isCreatingPrereq', false)
    const [isCreatingRepo, setIsCreatingRepo] = useState('isCreatingRepo', false)
    const [sharedFiles, setSharedFiles] = useState<ServiceFile[]>('sharedFiles', props.initial?.files ?? [])
    const [localFiles, setLocalFiles] = useState<ServiceFile[]>('localFiles', props.initial?.localFiles ?? [])

    const togglePrereqId = (id: string) => {
      const updated = selectedPrereqIds.includes(id)
        ? selectedPrereqIds.filter((pid) => pid !== id)
        : [...selectedPrereqIds, id]
      setSelectedPrereqIds(updated)
    }

    const togglePrereqServiceId = (id: string) => {
      const updated = selectedPrereqServiceIds.includes(id)
        ? selectedPrereqServiceIds.filter((sid) => sid !== id)
        : [...selectedPrereqServiceIds, id]
      setSelectedPrereqServiceIds(updated)
    }

    const repoOptions = [
      { value: '', label: '(None)' },
      ...(props.repositories ?? []).map((r) => ({ value: r.id, label: r.displayName })),
    ]

    return (
      <div>
        <Form<ServiceFormPayload>
          validate={isServiceFormPayload}
          onSubmit={(data) =>
            props.onSubmit({
              stackName: props.stackName,
              displayName: data.displayName,
              description: data.description,
              workingDirectory: data.workingDirectory || undefined,
              repositoryId: data.repositoryId || undefined,
              runCommand: data.runCommand,
              installCommand: data.installCommand || undefined,
              buildCommand: data.buildCommand || undefined,
              autoFetchEnabled: data.autoFetchEnabled === 'on',
              autoFetchIntervalMinutes: parseInt(data.autoFetchIntervalMinutes, 10) || 60,
              autoRestartOnFetch: data.autoRestartOnFetch === 'on',
              prerequisiteIds: selectedPrereqIds,
              prerequisiteServiceIds: selectedPrereqServiceIds,
              files: sharedFiles.filter((f) => f.relativePath.trim().length > 0),
              localFiles: localFiles.filter((f) => f.relativePath.trim().length > 0),
            })
          }
          disableOnSubmit
          style={{ display: 'flex', flexDirection: 'column', gap: '16px', maxWidth: '600px' }}
        >
          <h2 style={{ margin: '0' }}>{props.mode === 'create' ? 'Create Service' : 'Edit Service'}</h2>

          <h4 style={{ margin: '0', opacity: '0.7' }}>Definition</h4>
          <Input
            name="displayName"
            labelTitle="Display Name"
            variant="outlined"
            required
            value={props.initial?.displayName ?? ''}
          />
          <MarkdownEditor
            name="description"
            labelTitle="Description"
            value={props.initial?.description ?? ''}
            rows={4}
          />

          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <div style={{ flex: '1' }}>
              <Select
                name="repositoryId"
                labelTitle="GitHub Repository"
                variant="outlined"
                placeholder="None"
                value={props.initial?.repositoryId ?? ''}
                options={repoOptions}
                getHelperText={() => 'Link this service to a repository'}
              />
            </div>
            {props.onCreateRepository ? (
              <Button
                type="button"
                variant="outlined"
                size="small"
                onclick={() => setIsCreatingRepo(true)}
                startIcon={<Icon icon={icons.plus} size="small" />}
              >
                New
              </Button>
            ) : null}
          </div>

          <Input
            name="workingDirectory"
            labelTitle="Working Directory"
            variant="outlined"
            value={props.initial?.workingDirectory ?? ''}
            getHelperText={() =>
              'Optional. Relative path within stack for grouping, e.g. frontends/public or services/gateways'
            }
          />
          <Input
            name="runCommand"
            labelTitle="Run Command"
            variant="outlined"
            required
            value={props.initial?.runCommand ?? ''}
            getHelperText={() => 'e.g., npm start, yarn dev, dotnet run'}
          />
          <Input
            name="installCommand"
            labelTitle="Install Command"
            variant="outlined"
            value={props.initial?.installCommand ?? ''}
            getHelperText={() => 'e.g., npm install, yarn, dotnet restore'}
          />
          <Input
            name="buildCommand"
            labelTitle="Build Command"
            variant="outlined"
            value={props.initial?.buildCommand ?? ''}
            getHelperText={() => 'e.g., npm run build, yarn build, dotnet build'}
          />

          <FileList
            title="Shared Files"
            description="Files placed relative to the service root (e.g. .env, appConfig.local.json)."
            files={sharedFiles}
            onFilesChange={setSharedFiles}
            addLabel="Add File"
          />

          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', margin: '0 0 8px 0' }}>
              <h4 style={{ margin: '0', opacity: '0.7' }}>Local Files</h4>
              <Icon icon={icons.lock} size="small" title="Encrypted at rest, never exported" />
            </div>
            <FileList
              title=""
              description="Per-installation secret files. Encrypted at rest and never included in stack exports."
              files={localFiles}
              onFilesChange={setLocalFiles}
              addLabel="Add Local File"
              borderColor={cssVariableTheme.palette.warning.main}
              renderBadge={(file) => {
                const isOverridingShared = sharedFiles.some((sf) => sf.relativePath === file.relativePath)
                return isOverridingShared ? (
                  <span
                    style={{
                      fontSize: cssVariableTheme.typography.fontSize.xs,
                      padding: '2px 6px',
                      borderRadius: '4px',
                      background: cssVariableTheme.palette.warning.main,
                      color: cssVariableTheme.palette.warning.mainContrast,
                      whiteSpace: 'nowrap',
                    }}
                  >
                    Overrides shared
                  </span>
                ) : null
              }}
            />
          </div>

          {props.prerequisites ? (
            <PrerequisiteSelector
              prerequisites={props.prerequisites}
              selectedIds={selectedPrereqIds}
              onToggle={togglePrereqId}
              onCreateClick={props.onCreatePrerequisite ? () => setIsCreatingPrereq(true) : undefined}
            />
          ) : null}

          {props.otherServices && props.otherServices.length > 0 ? (
            <DependencySelector
              services={props.otherServices}
              selectedIds={selectedPrereqServiceIds}
              onToggle={togglePrereqServiceId}
            />
          ) : null}

          <h4 style={{ margin: '0', opacity: '0.7' }}>Configuration</h4>
          <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
            <Checkbox
              name="autoFetchEnabled"
              labelTitle="Auto-fetch"
              checked={props.initial?.autoFetchEnabled ?? false}
            />
            <Input
              name="autoFetchIntervalMinutes"
              labelTitle="Fetch interval (min)"
              type="number"
              variant="outlined"
              value={String(props.initial?.autoFetchIntervalMinutes ?? 60)}
              style={{ width: '150px' }}
            />
            <Checkbox
              name="autoRestartOnFetch"
              labelTitle="Auto-restart on fetch"
              checked={props.initial?.autoRestartOnFetch ?? false}
            />
          </div>
          <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
            {props.cancelHref ? (
              <StackCraftNestedRouteLink path={props.cancelHref}>
                <Button variant="outlined" startIcon={<Icon icon={icons.close} size="small" />}>
                  Cancel
                </Button>
              </StackCraftNestedRouteLink>
            ) : (
              <Button variant="outlined" onclick={props.onCancel} startIcon={<Icon icon={icons.close} size="small" />}>
                Cancel
              </Button>
            )}
            <Button
              type="submit"
              variant="contained"
              startIcon={<Icon icon={props.mode === 'create' ? icons.plus : icons.save} size="small" />}
            >
              {props.mode === 'create' ? 'Create' : 'Save'}
            </Button>
          </div>
        </Form>

        <Dialog
          isVisible={isCreatingPrereq && !!props.onCreatePrerequisite}
          title="Create Prerequisite"
          onClose={() => setIsCreatingPrereq(false)}
        >
          <PrerequisiteForm
            stackName={props.stackName}
            mode="create"
            onSubmit={async (data) => {
              const newId = await props.onCreatePrerequisite!(data)
              setSelectedPrereqIds([...selectedPrereqIds, newId])
              setIsCreatingPrereq(false)
            }}
            onCancel={() => setIsCreatingPrereq(false)}
          />
        </Dialog>

        <Dialog
          isVisible={isCreatingRepo && !!props.onCreateRepository}
          title="Create Repository"
          onClose={() => setIsCreatingRepo(false)}
        >
          <GitHubRepoForm
            stackName={props.stackName}
            mode="create"
            onSubmit={async (data) => {
              await props.onCreateRepository!(data)
              setIsCreatingRepo(false)
            }}
            onCancel={() => setIsCreatingRepo(false)}
          />
        </Dialog>
      </div>
    )
  },
})
