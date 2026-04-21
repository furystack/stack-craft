import { RequestError } from '@furystack/rest'
import { PasswordAuthenticator, PasswordComplexityError, UnauthenticatedError } from '@furystack/security'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { createMockActionContext, withTestInjector } from '../../../test-helpers.js'
import { PasswordResetAction } from './password-reset-action.js'

const getCurrentUserMock = vi.hoisted(() => vi.fn())

vi.mock('@furystack/core', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>()
  return { ...actual, getCurrentUser: getCurrentUserMock }
})

describe('PasswordResetAction', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('should reset password successfully', async () => {
    await withTestInjector(async ({ injector }) => {
      const mockAuthenticator = {
        setPasswordForUser: vi.fn().mockResolvedValue(undefined),
      }
      injector.setExplicitInstance(mockAuthenticator as unknown as PasswordAuthenticator, PasswordAuthenticator)
      getCurrentUserMock.mockResolvedValue({ username: 'testuser', roles: [] })

      const result = await PasswordResetAction(
        createMockActionContext({
          injector,
          body: { currentPassword: 'old-pass', newPassword: 'new-pass' },
        }),
      )
      const body = result.chunk

      expect(body.success).toBe(true)
      expect(mockAuthenticator.setPasswordForUser).toHaveBeenCalledWith('testuser', 'old-pass', 'new-pass')
    })
  })

  it('should throw 401 when user is not authenticated', async () => {
    await withTestInjector(async ({ injector }) => {
      const mockAuthenticator = {
        setPasswordForUser: vi.fn().mockResolvedValue(undefined),
      }
      injector.setExplicitInstance(mockAuthenticator as unknown as PasswordAuthenticator, PasswordAuthenticator)
      getCurrentUserMock.mockResolvedValue(null)

      await expect(
        PasswordResetAction(
          createMockActionContext({
            injector,
            body: { currentPassword: 'old', newPassword: 'new' },
          }),
        ),
      ).rejects.toThrow(RequestError)
    })
  })

  it('should throw 400 when current password is incorrect', async () => {
    await withTestInjector(async ({ injector }) => {
      const mockAuthenticator = {
        setPasswordForUser: vi.fn().mockRejectedValue(new UnauthenticatedError()),
      }
      injector.setExplicitInstance(mockAuthenticator as unknown as PasswordAuthenticator, PasswordAuthenticator)
      getCurrentUserMock.mockResolvedValue({ username: 'u', roles: [] })

      await expect(
        PasswordResetAction(
          createMockActionContext({
            injector,
            body: { currentPassword: 'wrong', newPassword: 'new' },
          }),
        ),
      ).rejects.toThrow('Current password is incorrect')
    })
  })

  it('should throw 400 when new password does not meet complexity requirements', async () => {
    await withTestInjector(async ({ injector }) => {
      const mockAuthenticator = {
        setPasswordForUser: vi
          .fn()
          .mockRejectedValue(new PasswordComplexityError([{ rule: 'minLength', message: 'Too short' }], 'Too short')),
      }
      injector.setExplicitInstance(mockAuthenticator as unknown as PasswordAuthenticator, PasswordAuthenticator)
      getCurrentUserMock.mockResolvedValue({ username: 'u', roles: [] })

      await expect(
        PasswordResetAction(
          createMockActionContext({
            injector,
            body: { currentPassword: 'old', newPassword: '1' },
          }),
        ),
      ).rejects.toThrow('Password does not meet complexity requirements')
    })
  })

  it('should rethrow RequestError as-is', async () => {
    await withTestInjector(async ({ injector }) => {
      const original = new RequestError('Custom error', 422)
      const mockAuthenticator = {
        setPasswordForUser: vi.fn().mockRejectedValue(original),
      }
      injector.setExplicitInstance(mockAuthenticator as unknown as PasswordAuthenticator, PasswordAuthenticator)
      getCurrentUserMock.mockResolvedValue({ username: 'u', roles: [] })

      await expect(
        PasswordResetAction(
          createMockActionContext({
            injector,
            body: { currentPassword: 'old', newPassword: 'new' },
          }),
        ),
      ).rejects.toBe(original)
    })
  })

  it('should throw 500 for unexpected errors', async () => {
    await withTestInjector(async ({ injector }) => {
      const mockAuthenticator = {
        setPasswordForUser: vi.fn().mockRejectedValue(new Error('DB connection lost')),
      }
      injector.setExplicitInstance(mockAuthenticator as unknown as PasswordAuthenticator, PasswordAuthenticator)
      getCurrentUserMock.mockResolvedValue({ username: 'u', roles: [] })

      await expect(
        PasswordResetAction(
          createMockActionContext({
            injector,
            body: { currentPassword: 'old', newPassword: 'new' },
          }),
        ),
      ).rejects.toThrow('Password reset failed')
    })
  })
})
