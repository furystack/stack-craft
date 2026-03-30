import { createComponent, Shade } from '@furystack/shades'
import { Button, cssVariableTheme, Icon, icons } from '@furystack/shades-common-components'
import type { ServiceFile } from 'common'

type FileListProps = {
  title: string
  description: string
  files: ServiceFile[]
  onFilesChange: (files: ServiceFile[]) => void
  addLabel: string
  borderColor?: string
  renderBadge?: (file: ServiceFile) => JSX.Element | null
}

export const FileList = Shade<FileListProps>({
  customElementName: 'shade-service-file-list',
  render: ({ props }) => {
    const { files, onFilesChange, borderColor } = props
    const border = borderColor ?? cssVariableTheme.divider

    return (
      <div>
        <h4 style={{ margin: '0 0 8px 0', opacity: '0.7' }}>{props.title}</h4>
        <p style={{ margin: '0 0 8px 0', opacity: '0.6', fontSize: cssVariableTheme.typography.fontSize.sm }}>
          {props.description}
        </p>
        {files.length > 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '8px' }}>
            {files.map((file, index) => (
              <div
                style={{
                  border: `2px solid ${border}`,
                  borderRadius: '8px',
                  padding: '12px',
                }}
              >
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '8px' }}>
                  <input
                    type="text"
                    placeholder="Relative path (e.g. .env)"
                    value={file.relativePath}
                    oninput={(ev: Event) => {
                      const updated = [...files]
                      updated[index] = { ...updated[index], relativePath: (ev.target as HTMLInputElement).value }
                      onFilesChange(updated)
                    }}
                    style={{
                      flex: '1',
                      padding: '6px 10px',
                      borderRadius: '4px',
                      border: `1px solid ${cssVariableTheme.divider}`,
                      background: 'transparent',
                      color: 'inherit',
                      fontFamily: 'monospace',
                      fontSize: cssVariableTheme.typography.fontSize.sm,
                    }}
                  />
                  {props.renderBadge?.(file) ?? null}
                  <Button
                    type="button"
                    variant="outlined"
                    color="error"
                    size="small"
                    onclick={() => onFilesChange(files.filter((_, i) => i !== index))}
                    startIcon={<Icon icon={icons.close} size="small" />}
                  >
                    Remove
                  </Button>
                </div>
                <textarea
                  placeholder="File content"
                  value={file.content}
                  oninput={(ev: Event) => {
                    const updated = [...files]
                    updated[index] = { ...updated[index], content: (ev.target as HTMLTextAreaElement).value }
                    onFilesChange(updated)
                  }}
                  rows={4}
                  style={{
                    width: '100%',
                    padding: '8px 10px',
                    borderRadius: '4px',
                    border: `1px solid ${cssVariableTheme.divider}`,
                    background: 'transparent',
                    color: 'inherit',
                    fontFamily: 'monospace',
                    fontSize: cssVariableTheme.typography.fontSize.sm,
                    resize: 'vertical',
                    boxSizing: 'border-box',
                  }}
                />
              </div>
            ))}
          </div>
        ) : null}
        <Button
          type="button"
          variant="outlined"
          size="small"
          onclick={() => onFilesChange([...files, { relativePath: '', content: '' }])}
          startIcon={<Icon icon={icons.plus} size="small" />}
        >
          {props.addLabel}
        </Button>
      </div>
    )
  },
})
