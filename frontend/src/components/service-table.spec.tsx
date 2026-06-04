import { createInjector } from '@furystack/inject'
import { createComponent, flushUpdates, initializeShadeRoot } from '@furystack/shades'
import { CollectionService, defaultDarkTheme, ThemeProviderService } from '@furystack/shades-common-components'
import type { ServiceView } from 'common'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { ServicesApiClient } from '../services/api-clients/services-api-client.js'
import { ServiceTable } from './service-table.js'

vi.mock('./app-routes.js', () => ({
  stackCraftNavigate: vi.fn(),
  StackCraftNestedRouteLink: () => null,
  stackCraftReplace: vi.fn(),
}))

const baseService: ServiceView = {
  id: 'svc-1',
  serviceId: 'svc-1',
  stackName: 'demo',
  displayName: 'API Gateway',
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
  currentBranch: 'main',
  commitsBehind: 3,
  createdAt: '',
  updatedAt: '',
}

describe('ServiceTable', () => {
  let root: HTMLDivElement
  let collectionService: CollectionService<ServiceView>

  afterEach(() => {
    root?.remove()
    collectionService?.[Symbol.dispose]()
  })

  it('should render primary, logs, and details actions only', async () => {
    const injector = createInjector()
    injector.get(ThemeProviderService).setAssignedTheme(defaultDarkTheme)
    injector.bind(ServicesApiClient, () => ({ call: vi.fn() }))
    collectionService = new CollectionService<ServiceView>({ searchField: 'displayName', idField: 'id' })

    root = document.createElement('div')
    document.body.appendChild(root)

    initializeShadeRoot({
      injector,
      rootElement: root,
      jsxElement: <ServiceTable services={[baseService]} collectionService={collectionService} />,
    })

    await flushUpdates()

    const table = root.querySelector('shade-service-table')
    expect(table).not.toBeNull()

    const actionButtons = table?.querySelectorAll('[aria-label]') ?? []
    const labels = Array.from(actionButtons).map((el) => el.getAttribute('aria-label'))
    expect(labels).toContain('Start')
    expect(labels).toContain('Logs')
    expect(labels).toContain('Details')
    expect(labels).not.toContain('Restart')
    expect(labels).not.toContain('Update')
    expect(labels).not.toContain('Edit')

    expect(table?.textContent).toContain('API Gateway')
    expect(table?.querySelector('[data-testid="commits-behind-badge"]')?.textContent).toContain('3 behind')
  })
})
