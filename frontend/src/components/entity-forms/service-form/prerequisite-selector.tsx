import { createComponent, Shade } from '@furystack/shades'
import { Button, cssVariableTheme, Icon, icons } from '@furystack/shades-common-components'
import type { Prerequisite } from 'common'

import { prerequisiteTypeLabels } from '../../status-chips.js'

type PrerequisiteSelectorProps = {
  prerequisites: Prerequisite[]
  selectedIds: string[]
  onToggle: (id: string) => void
  onCreateClick?: () => void
}

export const PrerequisiteSelector = Shade<PrerequisiteSelectorProps>({
  customElementName: 'shade-prerequisite-selector',
  render: ({ props }) => {
    return (
      <div>
        <h4 style={{ margin: '0 0 8px 0', opacity: '0.7' }}>Prerequisites</h4>
        {props.prerequisites.length > 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '8px' }}>
            {props.prerequisites.map((prereq) => {
              const isSelected = props.selectedIds.includes(prereq.id)
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
                    onchange={() => props.onToggle(prereq.id)}
                    style={{ margin: '0' }}
                  />
                  <span style={{ fontWeight: cssVariableTheme.typography.fontWeight.medium }}>{prereq.name}</span>
                  <span style={{ opacity: '0.6', fontSize: cssVariableTheme.typography.fontSize.sm }}>
                    {prerequisiteTypeLabels[prereq.type] ?? prereq.type}
                  </span>
                </label>
              )
            })}
          </div>
        ) : (
          <p style={{ margin: '0 0 8px 0', opacity: '0.6', fontSize: cssVariableTheme.typography.fontSize.md }}>
            No prerequisites defined for this stack yet.
          </p>
        )}
        {props.onCreateClick ? (
          <Button
            type="button"
            variant="outlined"
            size="small"
            onclick={props.onCreateClick}
            startIcon={<Icon icon={icons.plus} size="small" />}
          >
            Add Prerequisite
          </Button>
        ) : null}
      </div>
    )
  },
})
