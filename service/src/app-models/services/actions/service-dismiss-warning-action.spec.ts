import { ServiceDefinitionDataSet, ServiceGitStatusDataSet } from '../../data-store/tokens.js'
import { getDataSetFor } from '@furystack/repository'
import { describe, expect, it } from 'vitest'
import { createMockActionContext, withTestInjector } from '../../../test-helpers.js'
import { ServiceDismissWarningAction } from './service-dismiss-warning-action.js'
const addSvc = async (elevated: Parameters<Parameters<typeof withTestInjector>[0]>[0]['elevated']) => {
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
}

describe('ServiceDismissWarningAction', () => {
  it('creates a new ServiceGitStatus row with the dismissed flag set', () =>
    withTestInjector(async ({ elevated }) => {
      await addSvc(elevated)

      const ctx = createMockActionContext({
        injector: elevated,
        urlParams: { id: 'svc-1' },
        body: { kind: 'upstream-gone' as const },
      })
      await ServiceDismissWarningAction(ctx)

      const rows = await getDataSetFor(elevated, ServiceGitStatusDataSet).find(elevated, {
        filter: { serviceId: { $eq: 'svc-1' } },
        top: 1,
      })
      expect(rows[0]?.warningsDismissed?.upstreamGone).toBe(true)
    }))

  it('updates an existing ServiceGitStatus row', () =>
    withTestInjector(async ({ elevated }) => {
      await addSvc(elevated)
      await getDataSetFor(elevated, ServiceGitStatusDataSet).add(elevated, {
        serviceId: 'svc-1',
        currentBranch: 'main',
      })

      const ctx = createMockActionContext({
        injector: elevated,
        urlParams: { id: 'svc-1' },
        body: { kind: 'stale' as const },
      })
      await ServiceDismissWarningAction(ctx)

      const rows = await getDataSetFor(elevated, ServiceGitStatusDataSet).find(elevated, {
        filter: { serviceId: { $eq: 'svc-1' } },
        top: 1,
      })
      expect(rows[0]?.warningsDismissed?.stale).toBe(true)
      expect(rows[0]?.currentBranch).toBe('main')
    }))

  it('throws when the service is unknown', () =>
    withTestInjector(async ({ elevated }) => {
      const ctx = createMockActionContext({
        injector: elevated,
        urlParams: { id: 'missing' },
        body: { kind: 'stale' as const },
      })
      await expect(ServiceDismissWarningAction(ctx)).rejects.toThrow('Service not found')
    }))
})
