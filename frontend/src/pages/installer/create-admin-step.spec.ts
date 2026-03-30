import { describe, expect, it } from 'vitest'

import { isAdminPayload } from './create-admin-step.js'

describe('isAdminPayload', () => {
  const validPayload = { username: 'admin', password: 'secret' }

  it('should accept a valid payload', () => {
    expect(isAdminPayload(validPayload)).toBe(true)
  })

  it('should accept a payload with exactly 4-character password', () => {
    expect(isAdminPayload({ username: 'admin', password: 'abcd' })).toBe(true)
  })

  it('should throw on null (no null guard)', () => {
    expect(() => isAdminPayload(null)).toThrow()
  })

  it('should throw on undefined (no null guard)', () => {
    expect(() => isAdminPayload(undefined)).toThrow()
  })

  it('should reject when username is missing', () => {
    expect(isAdminPayload({ password: 'secret' })).toBe(false)
  })

  it('should reject when username is empty', () => {
    expect(isAdminPayload({ ...validPayload, username: '' })).toBe(false)
  })

  it('should reject when password is missing', () => {
    expect(isAdminPayload({ username: 'admin' })).toBe(false)
  })

  it('should reject when password is shorter than 4 characters', () => {
    expect(isAdminPayload({ username: 'admin', password: 'abc' })).toBe(false)
  })

  it('should reject when password is empty', () => {
    expect(isAdminPayload({ ...validPayload, password: '' })).toBe(false)
  })
})
