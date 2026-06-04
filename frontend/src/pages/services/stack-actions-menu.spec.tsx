import { createInjector } from '@furystack/inject'
import { createComponent, flushUpdates, initializeShadeRoot } from '@furystack/shades'
import { defaultDarkTheme, ThemeProviderService } from '@furystack/shades-common-components'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { StacksApiClient } from '../../services/api-clients/stacks-api-client.js'
import { StackActionsMenu } from './stack-actions-menu.js'

const stackCraftNavigate = vi.fn()

vi.mock('../../components/app-routes.js', () => ({
  stackCraftNavigate,
}))

describe('StackActionsMenu', () => {
  let root: HTMLDivElement

  afterEach(() => {
    root?.remove()
    stackCraftNavigate.mockClear()
  })

  it('should expose stack actions via the menu trigger', async () => {
    const setupCall = vi.fn().mockResolvedValue({})
    const injector = createInjector()
    injector.get(ThemeProviderService).setAssignedTheme(defaultDarkTheme)
    injector.bind(StacksApiClient, () => ({ call: setupCall }))

    root = document.createElement('div')
    document.body.appendChild(root)

    initializeShadeRoot({
      injector,
      rootElement: root,
      jsxElement: <StackActionsMenu stackName="demo-stack" />,
    })

    await flushUpdates()

    const trigger = root.querySelector('[aria-label="Stack actions"]')
    expect(trigger).not.toBeNull()
  })
})
