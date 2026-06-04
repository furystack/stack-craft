import { createInjector } from '@furystack/inject'
import { createComponent, flushUpdates, initializeShadeRoot } from '@furystack/shades'
import { defaultDarkTheme, ThemeProviderService } from '@furystack/shades-common-components'
import { afterEach, describe, expect, it, vi } from 'vitest'

const stackCraftReplace = vi.fn()

vi.mock('../app-routes.js', () => ({
  stackCraftReplace,
}))

import { StackRedirect } from './stack-redirect.js'

describe('StackRedirect', () => {
  let root: HTMLDivElement

  afterEach(() => {
    root?.remove()
    stackCraftReplace.mockClear()
  })

  it('should replace location with the stack services route on mount', async () => {
    const injector = createInjector()
    injector.get(ThemeProviderService).setAssignedTheme(defaultDarkTheme)

    root = document.createElement('div')
    document.body.appendChild(root)

    initializeShadeRoot({
      injector,
      rootElement: root,
      jsxElement: <StackRedirect stackName="my-stack" />,
    })

    await flushUpdates()

    expect(stackCraftReplace).toHaveBeenCalledWith(injector, {
      path: '/stacks/:stackName/services',
      params: { stackName: 'my-stack' },
    })
  })
})
