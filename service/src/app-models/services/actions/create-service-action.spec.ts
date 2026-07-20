import { getDataSetFor } from '@furystack/repository'
import { randomBytes } from 'crypto'
import { beforeAll, describe, expect, it, vi } from 'vitest'

import {
  ServiceConfigDataSet,
  ServiceDefinitionDataSet,
  ServiceDependencyLinkDataSet,
  ServicePrerequisiteLinkDataSet,
  ServiceStatusDataSet,
} from '../../data-store/tokens.js'
import { createMockActionContext, withTestInjector } from '../../../test-helpers.js'
import { CreateServiceAction } from './create-service-action.js'

type CreateServiceBody = Parameters<typeof CreateServiceAction>[0] extends { getBody: () => Promise<infer B> }
  ? B
  : never

const baseBody: CreateServiceBody = {
  id: 'svc-1',
  stackName: 'my-stack',
  displayName: 'Service 1',
  description: '',
  workingDirectory: 'svc',
  runCommand: 'echo hello',
  files: [],
  autoFetchEnabled: false,
  autoFetchIntervalMinutes: 60,
  autoRestartOnFetch: false,
  environmentVariableOverrides: {},
  localFiles: [],
  prerequisiteIds: [],
  prerequisiteServiceIds: [],
}

beforeAll(() => {
  process.env.STACK_CRAFT_ENCRYPTION_KEY = randomBytes(32).toString('base64')
})

describe('CreateServiceAction', () => {
  it('should persist the service definition, config, status, and link rows', async () => {
    await withTestInjector(async ({ elevated }) => {
      const body: CreateServiceBody = {
        ...baseBody,
        prerequisiteIds: ['prereq-a'],
        prerequisiteServiceIds: ['svc-dep'],
      }

      const result = await CreateServiceAction({
        ...createMockActionContext<CreateServiceBody>({ injector: elevated, body }),
        request: {} as never,
      })

      expect(result.chunk.id).toBe('svc-1')

      const defs = await getDataSetFor(elevated, ServiceDefinitionDataSet).find(elevated, {})
      expect(defs).toHaveLength(1)

      const configs = await getDataSetFor(elevated, ServiceConfigDataSet).find(elevated, {})
      expect(configs).toHaveLength(1)

      const statuses = await getDataSetFor(elevated, ServiceStatusDataSet).find(elevated, {})
      expect(statuses).toHaveLength(1)
      expect(statuses[0]?.runStatus).toBe('stopped')

      const prereqLinks = await getDataSetFor(elevated, ServicePrerequisiteLinkDataSet).find(elevated, {})
      expect(prereqLinks).toHaveLength(1)
      expect(prereqLinks[0]?.prerequisiteId).toBe('prereq-a')

      const depLinks = await getDataSetFor(elevated, ServiceDependencyLinkDataSet).find(elevated, {})
      expect(depLinks).toHaveLength(1)
      expect(depLinks[0]?.dependsOnServiceId).toBe('svc-dep')
    })
  })

  it('should reject with 409 when a service with the same id already exists', async () => {
    await withTestInjector(async ({ elevated }) => {
      const ts = new Date().toISOString()
      await getDataSetFor(elevated, ServiceDefinitionDataSet).add(elevated, {
        id: 'svc-1',
        stackName: 'my-stack',
        displayName: 'Original',
        description: '',
        workingDirectory: 'svc',
        runCommand: 'echo original',
        files: [],
        createdAt: ts,
        updatedAt: ts,
      })

      await expect(
        CreateServiceAction({
          ...createMockActionContext<CreateServiceBody>({
            injector: elevated,
            body: { ...baseBody, displayName: 'Duplicate' },
          }),
          request: {} as never,
        }),
      ).rejects.toMatchObject({
        message: expect.stringContaining('"svc-1" already exists'),
        responseCode: 409,
      })

      const defs = await getDataSetFor(elevated, ServiceDefinitionDataSet).find(elevated, {})
      expect(defs).toHaveLength(1)
      expect(defs[0]?.displayName).toBe('Original')

      const configs = await getDataSetFor(elevated, ServiceConfigDataSet).find(elevated, {})
      expect(configs).toHaveLength(0)
    })
  })

  it('should roll back every inserted row when the ServiceStatus insert fails', async () => {
    await withTestInjector(async ({ elevated }) => {
      const statusDs = getDataSetFor(elevated, ServiceStatusDataSet)
      vi.spyOn(statusDs, 'add').mockRejectedValueOnce(new Error('status store down'))

      await expect(
        CreateServiceAction({
          ...createMockActionContext<CreateServiceBody>({
            injector: elevated,
            body: { ...baseBody, prerequisiteIds: ['prereq-a'], prerequisiteServiceIds: ['svc-dep'] },
          }),
          request: {} as never,
        }),
      ).rejects.toMatchObject({
        message: expect.stringContaining('status store down'),
        responseCode: 500,
      })

      expect(await getDataSetFor(elevated, ServiceDefinitionDataSet).find(elevated, {})).toHaveLength(0)
      expect(await getDataSetFor(elevated, ServiceConfigDataSet).find(elevated, {})).toHaveLength(0)
      expect(await getDataSetFor(elevated, ServiceStatusDataSet).find(elevated, {})).toHaveLength(0)
      expect(await getDataSetFor(elevated, ServicePrerequisiteLinkDataSet).find(elevated, {})).toHaveLength(0)
      expect(await getDataSetFor(elevated, ServiceDependencyLinkDataSet).find(elevated, {})).toHaveLength(0)
    })
  })

  it('should roll back already-written link rows when a later link insert fails', async () => {
    await withTestInjector(async ({ elevated }) => {
      const depLinkDs = getDataSetFor(elevated, ServiceDependencyLinkDataSet)
      vi.spyOn(depLinkDs, 'add').mockRejectedValueOnce(new Error('dep-link store down'))

      await expect(
        CreateServiceAction({
          ...createMockActionContext<CreateServiceBody>({
            injector: elevated,
            body: { ...baseBody, prerequisiteIds: ['prereq-a'], prerequisiteServiceIds: ['svc-dep'] },
          }),
          request: {} as never,
        }),
      ).rejects.toMatchObject({
        message: expect.stringContaining('dep-link store down'),
        responseCode: 500,
      })

      expect(await getDataSetFor(elevated, ServiceDefinitionDataSet).find(elevated, {})).toHaveLength(0)
      expect(await getDataSetFor(elevated, ServiceConfigDataSet).find(elevated, {})).toHaveLength(0)
      expect(await getDataSetFor(elevated, ServiceStatusDataSet).find(elevated, {})).toHaveLength(0)
      expect(await getDataSetFor(elevated, ServicePrerequisiteLinkDataSet).find(elevated, {})).toHaveLength(0)
      expect(await getDataSetFor(elevated, ServiceDependencyLinkDataSet).find(elevated, {})).toHaveLength(0)
    })
  })
})
