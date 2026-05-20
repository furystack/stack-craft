import { getDataSetFor } from '@furystack/repository'
import { randomBytes } from 'crypto'
import { beforeAll, describe, expect, it, vi } from 'vitest'

import { StackConfigDataSet, StackDefinitionDataSet } from '../../data-store/tokens.js'
import { createMockActionContext, withTestInjector } from '../../../test-helpers.js'
import { CreateStackAction } from './create-stack-action.js'

type CreateStackBody = Parameters<typeof CreateStackAction>[0] extends { getBody: () => Promise<infer B> } ? B : never

const baseBody: CreateStackBody = {
  name: 'my-stack',
  displayName: 'My Stack',
  description: 'Example',
  mainDirectory: '/tmp/my-stack',
  environmentVariables: {},
}

beforeAll(() => {
  process.env.STACK_CRAFT_ENCRYPTION_KEY = randomBytes(32).toString('base64')
})

describe('CreateStackAction', () => {
  it('should persist the stack definition and config', async () => {
    await withTestInjector(async ({ elevated }) => {
      const result = await CreateStackAction({
        ...createMockActionContext<CreateStackBody>({ injector: elevated, body: baseBody }),
        request: {} as never,
      })

      expect(result.chunk.name).toBe('my-stack')

      const defs = await getDataSetFor(elevated, StackDefinitionDataSet).find(elevated, {})
      expect(defs).toHaveLength(1)
      expect(defs[0]?.displayName).toBe('My Stack')

      const configs = await getDataSetFor(elevated, StackConfigDataSet).find(elevated, {})
      expect(configs).toHaveLength(1)
      expect(configs[0]?.mainDirectory).toBe('/tmp/my-stack')
    })
  })

  it('should reject with 409 when a stack with the same name already exists', async () => {
    await withTestInjector(async ({ elevated }) => {
      const ts = new Date().toISOString()
      await getDataSetFor(elevated, StackDefinitionDataSet).add(elevated, {
        name: 'my-stack',
        displayName: 'Original',
        description: '',
        createdAt: ts,
        updatedAt: ts,
      })

      await expect(
        CreateStackAction({
          ...createMockActionContext<CreateStackBody>({
            injector: elevated,
            body: { ...baseBody, displayName: 'Duplicate' },
          }),
          request: {} as never,
        }),
      ).rejects.toMatchObject({
        message: expect.stringContaining('"my-stack" already exists'),
        responseCode: 409,
      })

      const defs = await getDataSetFor(elevated, StackDefinitionDataSet).find(elevated, {})
      expect(defs).toHaveLength(1)
      expect(defs[0]?.displayName).toBe('Original')

      const configs = await getDataSetFor(elevated, StackConfigDataSet).find(elevated, {})
      expect(configs).toHaveLength(0)
    })
  })

  it('should roll back the StackDefinition when the StackConfig insert fails', async () => {
    await withTestInjector(async ({ elevated }) => {
      const configDs = getDataSetFor(elevated, StackConfigDataSet)
      vi.spyOn(configDs, 'add').mockRejectedValueOnce(new Error('config store down'))

      await expect(
        CreateStackAction({
          ...createMockActionContext<CreateStackBody>({ injector: elevated, body: baseBody }),
          request: {} as never,
        }),
      ).rejects.toMatchObject({
        message: expect.stringContaining('config store down'),
        responseCode: 500,
      })

      const defs = await getDataSetFor(elevated, StackDefinitionDataSet).find(elevated, {})
      expect(defs).toHaveLength(0)

      const configs = await getDataSetFor(elevated, StackConfigDataSet).find(elevated, {})
      expect(configs).toHaveLength(0)
    })
  })
})
