import { createComponent, Shade } from '@furystack/shades'

import type { MenuEntry } from '@furystack/shades-common-components'
import { Button, Dropdown, Icon, icons } from '@furystack/shades-common-components'

import { runStackMenuAction, type StackMenuActionKey } from './run-stack-menu-action.js'

type StackActionsMenuProps = {
  stackName: string
}

export const StackActionsMenu = Shade<StackActionsMenuProps>({
  customElementName: 'shade-stack-actions-menu',
  render: ({ props, injector, useState }) => {
    const [isSetupRunning, setIsSetupRunning] = useState('isSetupRunning', false)

    const menuItems: MenuEntry[] = [
      {
        key: 'edit',
        label: 'Edit Stack',
        icon: <Icon icon={icons.edit} size="small" />,
      },
      {
        key: 'export',
        label: 'Export Stack',
        icon: <Icon icon={icons.download} size="small" />,
      },
      { type: 'divider', key: 'sep' },
      {
        key: 'setup-all',
        label: 'Set Up All',
        icon: <Icon icon={icons.settings} size="small" />,
      },
    ]

    const handleSelect = (key: string) => {
      if (key === 'setup-all') {
        setIsSetupRunning(true)
        void runStackMenuAction(injector, props.stackName, key).finally(() => setIsSetupRunning(false))
        return
      }
      void runStackMenuAction(injector, props.stackName, key as StackMenuActionKey)
    }

    return (
      <Dropdown items={menuItems} disabled={isSetupRunning} onSelect={handleSelect}>
        <Button
          variant="outlined"
          size="small"
          loading={isSetupRunning}
          aria-label="Stack actions"
          startIcon={<Icon icon={icons.moreVertical} size="small" />}
        />
      </Dropdown>
    )
  },
})
