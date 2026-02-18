import { createComponent, Shade } from '@furystack/shades'
import type { Stack } from 'common'

type StackSelectorProps = {
  stacks: Stack[]
  selectedStack: string | null
  onSelect: (stackName: string) => void
}

export const StackSelector = Shade<StackSelectorProps>({
  shadowDomName: 'shade-stack-selector',
  render: ({ props }) => {
    if (props.stacks.length <= 1) return null

    return (
      <select
        style={{
          background: 'transparent',
          color: 'inherit',
          border: '1px solid rgba(255,255,255,0.2)',
          borderRadius: '4px',
          padding: '4px 8px',
          fontSize: '14px',
          cursor: 'pointer',
        }}
        onchange={(e) => {
          const target = e.target as HTMLSelectElement
          props.onSelect(target.value)
        }}
      >
        {props.stacks.map((stack) => (
          <option value={stack.name} selected={stack.name === props.selectedStack}>
            {stack.displayName}
          </option>
        ))}
      </select>
    )
  },
})
