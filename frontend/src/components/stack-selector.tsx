import { createComponent, Shade } from '@furystack/shades'
import { Select } from '@furystack/shades-common-components'
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
      <Select
        variant="outlined"
        value={props.selectedStack ?? undefined}
        options={props.stacks.map((stack) => ({
          value: stack.name,
          label: stack.displayName,
        }))}
        onValueChange={(value) => props.onSelect(value)}
      />
    )
  },
})
