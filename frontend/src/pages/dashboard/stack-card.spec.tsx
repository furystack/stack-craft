import { createInjector } from '@furystack/inject'
import { createComponent, flushUpdates, initializeShadeRoot } from '@furystack/shades'
import { defaultDarkTheme, ThemeProviderService } from '@furystack/shades-common-components'
import type { ServiceView, StackDefinition } from 'common'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { ServicesApiClient } from '../../services/api-clients/services-api-client.js'
import { StackCard } from './stack-card.js'

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
  cloneStatus: 'cloned',
  installStatus: 'installed',
  buildStatus: 'built',
  runStatus: 'stopped',
  repositoryId: 'repo-1',
  createdAt: '',
  updatedAt: '',
}

const stack: StackDefinition = {
  name: 'demo',
  displayName: 'Demo Stack',
  description: '',
  createdAt: '',
  updatedAt: '',
}

describe('StackCard', () => {
  let root: HTMLDivElement

  afterEach(() => {
    root?.remove()
  })

  it('should render inline status chips and per-card action buttons', async () => {
    const apiCall = vi.fn().mockResolvedValue({})
    const injector = createInjector()
    injector.get(ThemeProviderService).setAssignedTheme(defaultDarkTheme)
    injector.bind(ServicesApiClient, () => ({ call: apiCall }))

    root = document.createElement('div')
    document.body.appendChild(root)

    initializeShadeRoot({
      injector,
      rootElement: root,
      jsxElement: (
        <StackCard
          stack={stack}
          stackServices={[
            { ...baseService, id: 'a', runStatus: 'running' },
            { ...baseService, id: 'b', runStatus: 'stopped' },
          ]}
          stackPrereqs={[]}
          checkResultMap={new Map()}
        />
      ),
    })

    await flushUpdates()

    const host = root.querySelector('stack-card')
    expect(host?.textContent).toContain('Demo Stack')
    expect(host?.textContent).toContain('2 services')
    expect(host?.textContent).toContain('1 running')
    expect(host?.textContent).toContain('1 stopped')

    const startAll = host?.querySelector('button') as HTMLButtonElement | null
    expect(startAll?.textContent).toContain('Start All')
    expect(startAll?.disabled).toBe(false)

    const stopAll = Array.from(host?.querySelectorAll('button') ?? []).find((b) => b.textContent?.includes('Stop All'))
    expect(stopAll?.hasAttribute('disabled')).toBe(false)

    const updateAll = Array.from(host?.querySelectorAll('button') ?? []).find((b) =>
      b.textContent?.includes('Update All'),
    )
    expect(updateAll?.hasAttribute('disabled')).toBe(false)
  })

  it('should disable Start All when every service is running', async () => {
    const injector = createInjector()
    injector.get(ThemeProviderService).setAssignedTheme(defaultDarkTheme)
    injector.bind(ServicesApiClient, () => ({ call: vi.fn() }))

    root = document.createElement('div')
    document.body.appendChild(root)

    initializeShadeRoot({
      injector,
      rootElement: root,
      jsxElement: (
        <StackCard
          stack={stack}
          stackServices={[{ ...baseService, runStatus: 'running' }]}
          stackPrereqs={[]}
          checkResultMap={new Map()}
        />
      ),
    })

    await flushUpdates()

    const startAll = Array.from(root.querySelectorAll('button')).find((b) => b.textContent?.includes('Start All'))
    expect(startAll?.disabled).toBe(true)
  })
})
