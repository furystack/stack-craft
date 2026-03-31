import { describe, expect, it } from 'vitest'

import { isPasswordChangePayload } from './password-change-form.js'

describe('isPasswordChangePayload', () => {
  const validPayload = {
    currentPassword: 'old-pass',
    newPassword: 'new-pass',
    confirmNewPassword: 'new-pass',
  }

  it('should accept a valid payload', () => {
    expect(isPasswordChangePayload(validPayload)).toBe(true)
  })

  it('should accept a payload with a 4-character new password', () => {
    expect(isPasswordChangePayload({ currentPassword: 'old', newPassword: 'abcd', confirmNewPassword: 'abcd' })).toBe(
      true,
    )
  })

  it('should throw on null (no null guard)', () => {
    expect(() => isPasswordChangePayload(null)).toThrow()
  })

  it('should throw on undefined (no null guard)', () => {
    expect(() => isPasswordChangePayload(undefined)).toThrow()
  })

  it('should reject when currentPassword is missing', () => {
    expect(isPasswordChangePayload({ newPassword: 'abcd', confirmNewPassword: 'abcd' })).toBe(false)
  })

  it('should reject when currentPassword is empty', () => {
    expect(isPasswordChangePayload({ ...validPayload, currentPassword: '' })).toBe(false)
  })

  it('should reject when newPassword is shorter than 4 characters', () => {
    expect(isPasswordChangePayload({ currentPassword: 'old', newPassword: 'abc', confirmNewPassword: 'abc' })).toBe(
      false,
    )
  })

  it('should reject when newPassword is empty', () => {
    expect(isPasswordChangePayload({ ...validPayload, newPassword: '', confirmNewPassword: '' })).toBe(false)
  })

  it('should reject when confirmNewPassword does not match newPassword', () => {
    expect(isPasswordChangePayload({ ...validPayload, confirmNewPassword: 'mismatch' })).toBe(false)
  })

  it('should reject when confirmNewPassword is missing', () => {
    expect(isPasswordChangePayload({ currentPassword: 'old', newPassword: 'abcd' })).toBe(false)
  })
})
