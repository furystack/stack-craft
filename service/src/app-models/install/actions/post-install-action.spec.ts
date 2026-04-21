import { getRepository } from '@furystack/repository'
import { User } from 'common'
import { describe, expect, it } from 'vitest'

import { createMockActionContext, withTestInjector } from '../../../test-helpers.js'
import { PostInstallAction } from './post-install-action.js'

describe('PostInstallAction', () => {
  it('should install the service and return success', async () => {
    await withTestInjector(async ({ injector, elevated }) => {
      const result = await PostInstallAction(
        createMockActionContext({
          injector,
          body: { username: 'admin', password: 'secret123' },
        }),
      )

      expect((result as { chunk: unknown }).chunk).toEqual({ success: true })

      const users = await getRepository(elevated).getDataSetFor(User, 'username').find(elevated, {})
      expect(users).toHaveLength(1)
      expect(users[0].username).toBe('admin')
    })
  })

  it('should throw if service is already installed', async () => {
    await withTestInjector(async ({ injector }) => {
      await PostInstallAction(
        createMockActionContext({
          injector,
          body: { username: 'admin', password: 'secret123' },
        }),
      )

      await expect(
        PostInstallAction(
          createMockActionContext({
            injector,
            body: { username: 'admin2', password: 'pass' },
          }) as Parameters<typeof PostInstallAction>[0],
        ),
      ).rejects.toThrow('Service is already installed')
    })
  })
})
