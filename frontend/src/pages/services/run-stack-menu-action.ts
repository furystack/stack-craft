import type { Injector } from '@furystack/inject'
import { NotyService } from '@furystack/shades-common-components'

import { stackCraftNavigate } from '../../components/app-routes.js'
import { StacksApiClient } from '../../services/api-clients/stacks-api-client.js'

export type StackMenuActionKey = 'edit' | 'export' | 'setup-all'

/**
 * Handles stack-level menu actions from the Services page header menu.
 */
export const runStackMenuAction = async (
  injector: Injector,
  stackName: string,
  key: StackMenuActionKey,
): Promise<void> => {
  if (key === 'edit') {
    stackCraftNavigate(injector, {
      path: '/stacks/:stackName/edit',
      params: { stackName },
    })
    return
  }

  if (key === 'export') {
    stackCraftNavigate(injector, {
      path: '/stacks/:stackName/export',
      params: { stackName },
    })
    return
  }

  try {
    await injector.get(StacksApiClient).call({
      method: 'POST',
      action: '/stacks/:id/setup',
      url: { id: stackName },
    })
  } catch (error: unknown) {
    injector.get(NotyService).emit('onNotyAdded', {
      title: 'Batch setup failed',
      body: error instanceof Error ? error.message : 'Setup error',
      type: 'error',
    })
  }
}
