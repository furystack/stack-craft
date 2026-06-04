import { createInjector } from '@furystack/inject'
import { createComponent, flushUpdates, initializeShadeRoot } from '@furystack/shades'
import { defaultDarkTheme, ThemeProviderService } from '@furystack/shades-common-components'
import { afterEach, describe, expect, it } from 'vitest'

import { ServicesEmptyState } from './services-empty-state.js'

describe('ServicesEmptyState', () => {
  let root: HTMLDivElement

  afterEach(() => {
    root?.remove()
  })

  it('should render three guided steps without a setup step', async () => {
    const injector = createInjector()
    injector.get(ThemeProviderService).setAssignedTheme(defaultDarkTheme)

    root = document.createElement('div')
    document.body.appendChild(root)

    initializeShadeRoot({
      injector,
      rootElement: root,
      jsxElement: <ServicesEmptyState stackName="demo-stack" repoCount={2} prereqCount={1} />,
    })

    await flushUpdates()

    const host = root.querySelector('shade-services-empty-state')
    expect(host).not.toBeNull()
    expect(host?.textContent).toContain('Add Repositories')
    expect(host?.textContent).toContain('Configure Prerequisites')
    expect(host?.textContent).toContain('Create Services')
    expect(host?.textContent).not.toContain('Run Setup')
    expect(host?.textContent).toContain('2 repositories configured')
    expect(host?.textContent).toContain('1 prerequisite configured')
  })
})
