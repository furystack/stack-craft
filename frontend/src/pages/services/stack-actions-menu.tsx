import { createComponent, Shade } from '@furystack/shades'

import type { MenuEntry } from '@furystack/shades-common-components'
import { Button, Dropdown, Icon, icons, NotyService } from '@furystack/shades-common-components'

import { stackCraftNavigate } from '../../components/app-routes.js'
import { StacksApiClient } from '../../services/api-clients/stacks-api-client.js'

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
      if (key === 'edit') {
        stackCraftNavigate(injector, {
          path: '/stacks/:stackName/edit',
          params: { stackName: props.stackName },
        })
        return
      }
      if (key === 'export') {
        stackCraftNavigate(injector, {
          path: '/stacks/:stackName/export',
          params: { stackName: props.stackName },
        })
        return
      }
      if (key === 'setup-all') {
        setIsSetupRunning(true)
        void injector
          .get(StacksApiClient)
          .call({
            method: 'POST',
            action: '/stacks/:id/setup',
            url: { id: props.stackName },
          })
          .catch((error: unknown) => {
            injector.get(NotyService).emit('onNotyAdded', {
              title: 'Batch setup failed',
              body: error instanceof Error ? error.message : 'Setup error',
              type: 'error',
            })
          })
          .finally(() => setIsSetupRunning(false))
      }
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
