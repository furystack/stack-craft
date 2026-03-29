import { Injector } from '@furystack/inject'
import { useLogging, VerboseConsoleLogger } from '@furystack/logging'
import { RequestError } from '@furystack/rest'
import { PasswordAuthenticator, PasswordComplexityError, UnauthenticatedError } from '@furystack/security'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { PasswordResetAction } from './password-reset-action.js'

const getCurrentUserMock = vi.hoisted(() => vi.fn())

vi.mock('@furystack/core', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>()
  return { ...actual, getCurrentUser: getCurrentUserMock }
})

const createMockActionContext = <TBody = unknown>(options: { injector: Injector; body?: TBody }) => ({
  injector: options.injector,
  getBody: () => Promise.resolve(options.body as TBody),
  getUrlParams: () => ({}) as never,
  getQuery: () => ({}) as never,
  request: {} as never,
  response: {} as never,
})

describe('PasswordResetAction', () => {
  let injector: Injector
  let mockAuthenticator: { setPasswordForUser: ReturnType<typeof vi.fn> }

  beforeEach(() => {
    injector = new Injector()
    useLogging(injector, VerboseConsoleLogger)

    mockAuthenticator = {
      setPasswordForUser: vi.fn().mockResolvedValue(undefined),
    }
    injector.setExplicitInstance(mockAuthenticator as unknown as PasswordAuthenticator, PasswordAuthenticator)

    getCurrentUserMock.mockResolvedValue({ username: 'testuser', roles: [] })
  })

  afterEach(async () => {
    vi.restoreAllMocks()
    await injector[Symbol.asyncDispose]()
  })

  it('should reset password successfully', async () => {
    const result = await PasswordResetAction(
      createMockActionContext({
        injector,
        body: { currentPassword: 'old-pass', newPassword: 'new-pass' },
      }),
    )
    const body = result.chunk as { success: boolean }

    expect(body.success).toBe(true)
    expect(mockAuthenticator.setPasswordForUser).toHaveBeenCalledWith('testuser', 'old-pass', 'new-pass')
  })

  it('should throw 401 when user is not authenticated', async () => {
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

  it('should throw 400 when current password is incorrect', async () => {
    mockAuthenticator.setPasswordForUser.mockRejectedValue(new UnauthenticatedError())

    await expect(
      PasswordResetAction(
        createMockActionContext({
          injector,
          body: { currentPassword: 'wrong', newPassword: 'new' },
        }),
      ),
    ).rejects.toThrow('Current password is incorrect')
  })

  it('should throw 400 when new password does not meet complexity requirements', async () => {
    mockAuthenticator.setPasswordForUser.mockRejectedValue(
      new PasswordComplexityError([{ rule: 'minLength', message: 'Too short' }], 'Too short'),
    )

    await expect(
      PasswordResetAction(
        createMockActionContext({
          injector,
          body: { currentPassword: 'old', newPassword: '1' },
        }),
      ),
    ).rejects.toThrow('Password does not meet complexity requirements')
  })

  it('should rethrow RequestError as-is', async () => {
    const original = new RequestError('Custom error', 422)
    mockAuthenticator.setPasswordForUser.mockRejectedValue(original)

    await expect(
      PasswordResetAction(
        createMockActionContext({
          injector,
          body: { currentPassword: 'old', newPassword: 'new' },
        }),
      ),
    ).rejects.toBe(original)
  })

  it('should throw 500 for unexpected errors', async () => {
    mockAuthenticator.setPasswordForUser.mockRejectedValue(new Error('DB connection lost'))

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
