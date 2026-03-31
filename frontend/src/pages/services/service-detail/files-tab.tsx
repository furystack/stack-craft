import { createComponent, Shade } from '@furystack/shades'
import { Button, Chip, cssVariableTheme, Icon, icons, Paper } from '@furystack/shades-common-components'
import type { ServiceFile, ServiceView } from 'common'

import { LazyMonacoEditor } from '../../../components/lazy-monaco-editor.js'
import { getMonacoLanguage } from '../../../utils/get-monaco-language.js'

type FileEntry = {
  kind: 'shared' | 'local'
  file: ServiceFile
  index: number
}

type FilesTabProps = {
  service: ServiceView
  actionInProgress: string | null
  onSaveFiles: (files: ServiceFile[], localFiles: ServiceFile[]) => Promise<void>
  onApplyFiles: (relativePath?: string) => Promise<void>
}

export const FilesTab = Shade<FilesTabProps>({
  customElementName: 'shade-service-files-tab',
  render: ({ props, useState }) => {
    const { service, actionInProgress } = props

    const [sharedFiles, setSharedFiles] = useState<ServiceFile[]>('sharedFiles', [...(service.files ?? [])])
    const [localFiles, setLocalFiles] = useState<ServiceFile[]>('localFiles', [...(service.localFiles ?? [])])
    const [selected, setSelected] = useState<{ kind: 'shared' | 'local'; index: number } | null>('selected', null)
    const [isDirty, setIsDirty] = useState('isDirty', false)

    const getSelectedEntry = (): FileEntry | null => {
      if (!selected) return null
      const files = selected.kind === 'shared' ? sharedFiles : localFiles
      const file = files[selected.index]
      if (!file) return null
      return { kind: selected.kind, file, index: selected.index }
    }

    const selectedEntry = getSelectedEntry()
    const language = selectedEntry ? getMonacoLanguage(selectedEntry.file.relativePath) : 'plaintext'

    const localPaths = new Set(localFiles.map((f) => f.relativePath))
    const sharedPaths = new Set(sharedFiles.map((f) => f.relativePath))

    const updateFile = (kind: 'shared' | 'local', index: number, patch: Partial<ServiceFile>) => {
      if (kind === 'shared') {
        const updated = [...sharedFiles]
        updated[index] = { ...updated[index], ...patch }
        setSharedFiles(updated)
      } else {
        const updated = [...localFiles]
        updated[index] = { ...updated[index], ...patch }
        setLocalFiles(updated)
      }
      setIsDirty(true)
    }

    const addFile = (kind: 'shared' | 'local') => {
      const newFile: ServiceFile = { relativePath: '', content: '' }
      if (kind === 'shared') {
        const newFiles = [...sharedFiles, newFile]
        setSharedFiles(newFiles)
        setSelected({ kind: 'shared', index: newFiles.length - 1 })
      } else {
        const newFiles = [...localFiles, newFile]
        setLocalFiles(newFiles)
        setSelected({ kind: 'local', index: newFiles.length - 1 })
      }
      setIsDirty(true)
    }

    const removeFile = (kind: 'shared' | 'local', index: number) => {
      if (kind === 'shared') {
        setSharedFiles(sharedFiles.filter((_, i) => i !== index))
      } else {
        setLocalFiles(localFiles.filter((_, i) => i !== index))
      }
      if (selected && selected.kind === kind && selected.index === index) {
        setSelected(null)
      } else if (selected && selected.kind === kind && selected.index > index) {
        setSelected({ kind, index: selected.index - 1 })
      }
      setIsDirty(true)
    }

    const handleSave = async () => {
      const cleaned = sharedFiles.filter((f) => f.relativePath.trim().length > 0)
      const cleanedLocal = localFiles.filter((f) => f.relativePath.trim().length > 0)
      await props.onSaveFiles(cleaned, cleanedLocal)
      setIsDirty(false)
    }

    const sidebarWidth = '260px'

    const renderFileItem = (entry: FileEntry) => {
      const isSelected = selected?.kind === entry.kind && selected?.index === entry.index
      const isOverridden = entry.kind === 'shared' && localPaths.has(entry.file.relativePath)
      const isOverriding = entry.kind === 'local' && sharedPaths.has(entry.file.relativePath)

      return (
        <div
          onclick={() => setSelected({ kind: entry.kind, index: entry.index })}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            padding: '6px 10px',
            borderRadius: '6px',
            cursor: 'pointer',
            fontFamily: 'monospace',
            fontSize: cssVariableTheme.typography.fontSize.sm,
            background: isSelected ? cssVariableTheme.palette.primary.main : 'transparent',
            color: isSelected ? cssVariableTheme.palette.primary.mainContrast : 'inherit',
            opacity: isOverridden ? '0.5' : '1',
            overflow: 'hidden',
          }}
        >
          {entry.kind === 'local' ? <Icon icon={icons.lock} size={12} /> : null}
          <span
            style={{
              flex: '1',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {entry.file.relativePath || '(new file)'}
          </span>
          {isOverridden ? (
            <Chip variant="outlined" size="small" style={{ fontSize: '10px' }}>
              overridden
            </Chip>
          ) : null}
          {isOverriding ? (
            <Chip variant="outlined" size="small" style={{ fontSize: '10px' }}>
              override
            </Chip>
          ) : null}
          <button
            type="button"
            onclick={(e: Event) => {
              e.stopPropagation()
              removeFile(entry.kind, entry.index)
            }}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: 'inherit',
              padding: '2px',
              lineHeight: '1',
              opacity: '0.6',
              flexShrink: '0',
            }}
            title="Remove file"
          >
            <Icon icon={icons.close} size={12} />
          </button>
        </div>
      )
    }

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {/* Header toolbar */}
        <Paper
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            flexWrap: 'wrap',
          }}
        >
          <h3 style={{ margin: '0', flex: '1' }}>Service Files</h3>
          {isDirty ? (
            <Chip variant="outlined" size="small" style={{ color: cssVariableTheme.palette.warning.main }}>
              Unsaved changes
            </Chip>
          ) : null}
          <Button
            variant="outlined"
            size="small"
            disabled={!!actionInProgress || !isDirty}
            onclick={() => void handleSave()}
            startIcon={<Icon icon={icons.save} size="small" />}
          >
            Save
          </Button>
          <Button
            variant="outlined"
            size="small"
            loading={actionInProgress === 'apply-files-all'}
            disabled={!!actionInProgress}
            onclick={() => void props.onApplyFiles()}
            startIcon={<Icon icon={icons.download} size="small" />}
          >
            Apply All
          </Button>
        </Paper>

        {/* Master-detail layout */}
        <div style={{ display: 'flex', gap: '16px', minHeight: '500px' }}>
          {/* Sidebar */}
          <Paper
            style={{
              width: sidebarWidth,
              flexShrink: '0',
              display: 'flex',
              flexDirection: 'column',
              gap: '4px',
              overflow: 'auto',
            }}
          >
            {/* Shared files group */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                marginBottom: '4px',
              }}
            >
              <span
                style={{
                  fontSize: cssVariableTheme.typography.fontSize.sm,
                  fontWeight: 'bold',
                  opacity: '0.7',
                }}
              >
                Shared Files
              </span>
              <Chip variant="outlined" size="small">
                {sharedFiles.length}
              </Chip>
            </div>
            {sharedFiles.map((file, index) => renderFileItem({ kind: 'shared', file, index }))}
            <Button
              type="button"
              variant="outlined"
              size="small"
              onclick={() => addFile('shared')}
              startIcon={<Icon icon={icons.plus} size="small" />}
              style={{ marginTop: '4px', alignSelf: 'flex-start' }}
            >
              Add File
            </Button>

            {/* Divider */}
            <div
              style={{
                height: '1px',
                background: cssVariableTheme.divider,
                margin: '12px 0',
              }}
            />

            {/* Local files group */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                marginBottom: '4px',
              }}
            >
              <Icon icon={icons.lock} size="small" title="Encrypted at rest, never exported" />
              <span
                style={{
                  fontSize: cssVariableTheme.typography.fontSize.sm,
                  fontWeight: 'bold',
                  opacity: '0.7',
                }}
              >
                Local Files
              </span>
              <Chip variant="outlined" size="small">
                {localFiles.length}
              </Chip>
            </div>
            {localFiles.map((file, index) => renderFileItem({ kind: 'local', file, index }))}
            <Button
              type="button"
              variant="outlined"
              size="small"
              onclick={() => addFile('local')}
              startIcon={<Icon icon={icons.plus} size="small" />}
              style={{ marginTop: '4px', alignSelf: 'flex-start' }}
            >
              Add Local File
            </Button>
          </Paper>

          {/* Editor panel */}
          <Paper
            style={{
              flex: '1',
              display: 'flex',
              flexDirection: 'column',
              minWidth: '0',
              overflow: 'hidden',
            }}
          >
            {selectedEntry ? (
              <>
                {/* Path input + actions */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    marginBottom: '12px',
                    flexWrap: 'wrap',
                  }}
                >
                  <input
                    type="text"
                    placeholder="Relative path (e.g. .env, config/settings.json)"
                    value={selectedEntry.file.relativePath}
                    oninput={(ev: Event) => {
                      updateFile(selectedEntry.kind, selectedEntry.index, {
                        relativePath: (ev.target as HTMLInputElement).value,
                      })
                    }}
                    style={{
                      flex: '1',
                      minWidth: '200px',
                      padding: '6px 10px',
                      borderRadius: '4px',
                      border: `1px solid ${cssVariableTheme.divider}`,
                      background: 'transparent',
                      color: 'inherit',
                      fontFamily: 'monospace',
                      fontSize: cssVariableTheme.typography.fontSize.sm,
                    }}
                  />
                  <Chip variant="outlined" size="small">
                    {language}
                  </Chip>
                  {selectedEntry.kind === 'local' ? (
                    <Chip variant="outlined" size="small" style={{ color: cssVariableTheme.palette.warning.main }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <Icon icon={icons.lock} size={12} />
                        local
                      </span>
                    </Chip>
                  ) : null}
                  <Button
                    variant="outlined"
                    size="small"
                    loading={actionInProgress === `apply-file-${selectedEntry.file.relativePath}`}
                    disabled={!!actionInProgress || !selectedEntry.file.relativePath}
                    onclick={() => void props.onApplyFiles(selectedEntry.file.relativePath)}
                    startIcon={<Icon icon={icons.download} size="small" />}
                  >
                    Apply
                  </Button>
                  <Button
                    variant="outlined"
                    size="small"
                    color="error"
                    onclick={() => removeFile(selectedEntry.kind, selectedEntry.index)}
                    startIcon={<Icon icon={icons.close} size="small" />}
                  >
                    Remove
                  </Button>
                </div>

                {/* Monaco editor */}
                <div style={{ flex: '1', minHeight: '400px', borderRadius: '4px', overflow: 'hidden' }}>
                  <LazyMonacoEditor
                    value={selectedEntry.file.content}
                    language={language}
                    onValueChange={(value) => {
                      updateFile(selectedEntry.kind, selectedEntry.index, { content: value })
                    }}
                  />
                </div>
              </>
            ) : (
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  height: '100%',
                  minHeight: '400px',
                  opacity: '0.5',
                  gap: '12px',
                }}
              >
                <Icon icon={icons.code} size={48} />
                <span style={{ fontSize: cssVariableTheme.typography.fontSize.md }}>
                  Select a file to view and edit its content
                </span>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <Button
                    variant="outlined"
                    size="small"
                    onclick={() => addFile('shared')}
                    startIcon={<Icon icon={icons.plus} size="small" />}
                  >
                    Add Shared File
                  </Button>
                  <Button
                    variant="outlined"
                    size="small"
                    onclick={() => addFile('local')}
                    startIcon={<Icon icon={icons.plus} size="small" />}
                  >
                    Add Local File
                  </Button>
                </div>
              </div>
            )}
          </Paper>
        </div>
      </div>
    )
  },
})
