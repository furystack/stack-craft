import { createInjector } from '@furystack/inject'
import { NotyService } from '@furystack/shades-common-components'
import { describe, expect, it, vi } from 'vitest'

import { StacksApiClient } from '../../services/api-clients/stacks-api-client.js'
import { runStackMenuAction } from './run-stack-menu-action.js'

const mocks = vi.hoisted(() => ({
  stackCraftNavigate: vi.fn(),
}))

vi.mock('../../components/app-routes.js', () => ({
  stackCraftNavigate: mocks.stackCraftNavigate,
}))

describe('runStackMenuAction', () => {
  it('should navigate to edit stack', async () => {
    const injector = createInjector()
    await runStackMenuAction(injector, 'demo-stack', 'edit')

    expect(mocks.stackCraftNavigate).toHaveBeenCalledWith(injector, {
      path: '/stacks/:stackName/edit',
      params: { stackName: 'demo-stack' },
    })
  })

  it('should navigate to export stack', async () => {
    const injector = createInjector()
    await runStackMenuAction(injector, 'demo-stack', 'export')

    expect(mocks.stackCraftNavigate).toHaveBeenCalledWith(injector, {
      path: '/stacks/:stackName/export',
      params: { stackName: 'demo-stack' },
    })
  })

  it('should call batch setup and emit noty on failure', async () => {
    const setupCall = vi.fn().mockRejectedValue(new Error('setup boom'))
    const notyEmit = vi.fn()
    const injector = createInjector()
    injector.bind(StacksApiClient, () => ({ call: setupCall }))
    injector.bind(NotyService, () => ({ emit: notyEmit }) as unknown as NotyService)

    await runStackMenuAction(injector, 'demo-stack', 'setup-all')

    expect(setupCall).toHaveBeenCalledWith({
      method: 'POST',
      action: '/stacks/:id/setup',
      url: { id: 'demo-stack' },
    })
    expect(notyEmit).toHaveBeenCalledWith('onNotyAdded', {
      title: 'Batch setup failed',
      body: 'setup boom',
      type: 'error',
    })
  })
})
