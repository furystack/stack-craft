import { createInjector } from '@furystack/inject'
import { createComponent, flushUpdates, initializeShadeRoot, LocationService } from '@furystack/shades'
import { defaultDarkTheme, ThemeProviderService } from '@furystack/shades-common-components'
import type { ServiceView, StackView } from 'common'
import { afterEach, describe, expect, it } from 'vitest'

import { SidebarStackItem } from './sidebar-stack-item.js'

const stack: StackView = {
  name: 'demo',
  displayName: 'Demo Stack',
  description: '',
  stackName: 'demo',
  mainDirectory: '/tmp/demo',
  environmentVariables: {},
  createdAt: '',
  updatedAt: '',
}

const baseService: ServiceView = {
  id: 'svc-1',
  serviceId: 'svc-1',
  stackName: 'demo',
  displayName: 'API',
  description: '',
  runCommand: 'npm start',
  prerequisiteIds: [],
  prerequisiteServiceIds: [],
  files: [],
  autoFetchEnabled: false,
  autoFetchIntervalMinutes: 60,
  autoRestartOnFetch: false,
  environmentVariableOverrides: {},
  localFiles: [],
  cloneStatus: 'not-cloned',
  installStatus: 'not-installed',
  buildStatus: 'not-built',
  runStatus: 'running',
  createdAt: '',
  updatedAt: '',
}

describe('SidebarStackItem', () => {
  let root: HTMLDivElement

  afterEach(() => {
    root?.remove()
  })

  it('should show status dot, services count, and no overview/setup links', async () => {
    const injector = createInjector()
    injector.get(ThemeProviderService).setAssignedTheme(defaultDarkTheme)
    injector.get(LocationService).navigate('/stacks/demo/services')

    root = document.createElement('div')
    document.body.appendChild(root)

    initializeShadeRoot({
      injector,
      rootElement: root,
      jsxElement: (
        <SidebarStackItem
          stack={stack}
          stackServices={[baseService, { ...baseService, id: 'svc-2', runStatus: 'stopped' }]}
          currentUrl="/stacks/demo/services"
          showAccordion
        />
      ),
    })

    await flushUpdates()

    const host = root.querySelector('shade-sidebar-stack-item')
    expect(host?.querySelector('[data-testid="stack-status-dot"]')).not.toBeNull()
    expect(host?.textContent).toContain('Services')
    expect(host?.textContent).toContain('2')
    expect(host?.textContent).not.toContain('Overview')
    expect(host?.textContent).not.toContain('Setup')
  })
})
