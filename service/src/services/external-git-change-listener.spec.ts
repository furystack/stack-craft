import {
  ServiceDefinitionDataSet,
  ServiceStateHistoryDataSet,
  ServiceStatusDataSet,
} from '../app-models/data-store/tokens.js'
import { getDataSetFor } from '@furystack/repository'
import type { ServiceStatus } from 'common'
import { describe, expect, it, vi } from 'vitest'
import { withTestInjector } from '../test-helpers.js'
import { ExternalGitChangeListener } from './external-git-change-listener.js'
import { GitHeadWatcher, type GitHeadChangeEvent } from './git-head-watcher.js'
const seed = async (
  elevated: Parameters<Parameters<typeof withTestInjector>[0]>[0]['elevated'],
  status: Partial<ServiceStatus> = {},
) => {
  const ts = new Date().toISOString()
  await getDataSetFor(elevated, ServiceDefinitionDataSet).add(elevated, {
    id: 'svc-1',
    stackName: 'stack',
    displayName: 'Test',
    description: '',
    runCommand: 'npm start',
    files: [],
    createdAt: ts,
    updatedAt: ts,
  })
  await getDataSetFor(elevated, ServiceStatusDataSet).add(elevated, {
    serviceId: 'svc-1',
    cloneStatus: 'cloned',
    installStatus: 'installed',
    buildStatus: 'built',
    runStatus: 'stopped',
    updatedAt: ts,
    ...status,
  })
}

describe('ExternalGitChangeListener', () => {
  it('records a history entry and marks install/build stale on branch-switched', () =>
    withTestInjector(async ({ injector, elevated }) => {
      await seed(elevated)
      const watcher = injector.get(GitHeadWatcher)
      const listener = injector.get(ExternalGitChangeListener)
      listener.start()

      const event: GitHeadChangeEvent = {
        serviceId: 'svc-1',
        previousBranch: 'main',
        currentBranch: 'feature/foo',
        kind: 'branch-switched',
      }
      watcher.emit('externalChange', event)

      await vi.waitFor(
        async () => {
          const statuses = await getDataSetFor(elevated, ServiceStatusDataSet).find(elevated, {
            filter: { serviceId: { $eq: 'svc-1' } },
            top: 1,
          })
          expect(statuses[0]?.installStatus).toBe('stale')
          expect(statuses[0]?.buildStatus).toBe('stale')

          const history = await getDataSetFor(elevated, ServiceStateHistoryDataSet).find(elevated, {})
          expect(history.map((h) => h.event)).toContain('external-branch-changed')
          expect(history.map((h) => h.event)).toContain('marked-stale')
        },
        { timeout: 1000 },
      )
    }))

  it('uses external-pull-detected event when the ref SHA changes', () =>
    withTestInjector(async ({ injector, elevated }) => {
      await seed(elevated)
      const watcher = injector.get(GitHeadWatcher)
      const listener = injector.get(ExternalGitChangeListener)
      listener.start()

      watcher.emit('externalChange', {
        serviceId: 'svc-1',
        currentBranch: 'main',
        kind: 'pull-detected',
      })

      await vi.waitFor(
        async () => {
          const history = await getDataSetFor(elevated, ServiceStateHistoryDataSet).find(elevated, {})
          expect(history.map((h) => h.event)).toContain('external-pull-detected')
        },
        { timeout: 1000 },
      )
    }))

  it('does not mark stale when install/build are not already in the final state', () =>
    withTestInjector(async ({ injector, elevated }) => {
      await seed(elevated, { installStatus: 'not-installed', buildStatus: 'not-built' })
      const watcher = injector.get(GitHeadWatcher)
      const listener = injector.get(ExternalGitChangeListener)
      listener.start()

      watcher.emit('externalChange', {
        serviceId: 'svc-1',
        previousBranch: 'main',
        currentBranch: 'feature/foo',
        kind: 'branch-switched',
      })

      await vi.waitFor(
        async () => {
          const history = await getDataSetFor(elevated, ServiceStateHistoryDataSet).find(elevated, {})
          expect(history.map((h) => h.event)).toContain('external-branch-changed')
        },
        { timeout: 1000 },
      )

      const statuses = await getDataSetFor(elevated, ServiceStatusDataSet).find(elevated, {
        filter: { serviceId: { $eq: 'svc-1' } },
        top: 1,
      })
      expect(statuses[0]?.installStatus).toBe('not-installed')
      expect(statuses[0]?.buildStatus).toBe('not-built')
    }))
})
