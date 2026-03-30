import { createComponent, Shade } from '@furystack/shades'
import { cssVariableTheme } from '@furystack/shades-common-components'

type DependencySelectorProps = {
  services: Array<{ id: string; displayName: string }>
  selectedIds: string[]
  onToggle: (id: string) => void
}

export const DependencySelector = Shade<DependencySelectorProps>({
  customElementName: 'shade-dependency-selector',
  render: ({ props }) => {
    if (props.services.length === 0) return <div />

    return (
      <div>
        <h4 style={{ margin: '0 0 8px 0', opacity: '0.7' }}>Prerequisite Services</h4>
        <p style={{ margin: '0 0 8px 0', opacity: '0.6', fontSize: cssVariableTheme.typography.fontSize.sm }}>
          Services that must be running before this one starts.
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          {props.services.map((svc) => {
            const isSelected = props.selectedIds.includes(svc.id)
            return (
              <label
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  padding: '8px 12px',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  border: isSelected
                    ? `2px solid ${cssVariableTheme.palette.primary.main}`
                    : `2px solid ${cssVariableTheme.divider}`,
                  background: isSelected ? cssVariableTheme.button.hover : 'transparent',
                  transition: 'all 0.15s',
                }}
              >
                <input
                  type="checkbox"
                  checked={isSelected}
                  onchange={() => props.onToggle(svc.id)}
                  style={{ margin: '0' }}
                />
                <span style={{ fontWeight: cssVariableTheme.typography.fontWeight.medium }}>{svc.displayName}</span>
              </label>
            )
          })}
        </div>
      </div>
    )
  },
})
