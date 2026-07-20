import { createInjector } from '@furystack/inject'
import { createComponent, flushUpdates, initializeShadeRoot } from '@furystack/shades'
import { CollectionService, defaultDarkTheme, ThemeProviderService } from '@furystack/shades-common-components'
import type { ServiceView } from 'common'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { ServicesApiClient } from '../services/api-clients/services-api-client.js'
import { ServiceTable } from './service-table.js'

vi.mock('./app-routes.js', () => ({
  stackCraftNavigate: vi.fn(),
  StackCraftNestedRouteLink: ({ children }: { children?: unknown }) => children,
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

  it('should render the service grid with expected columns and sync collection data', async () => {
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

    expect(root.querySelector('shade-service-table')).not.toBeNull()
    expect(root.textContent).toContain('Service')
    expect(root.textContent).toContain('Status')
    expect(root.textContent).toContain('Branch')
    expect(root.textContent).toContain('Actions')
    expect(collectionService.data.getValue().entries).toHaveLength(1)
    expect(collectionService.data.getValue().entries[0]?.displayName).toBe('API Gateway')
  })
})
