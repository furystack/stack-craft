import { describe, expect, it } from 'vitest'

import { isCreateTokenPayload } from './api-tokens-section.js'

describe('isCreateTokenPayload', () => {
  it('should accept a valid payload', () => {
    expect(isCreateTokenPayload({ name: 'my-token' })).toBe(true)
  })

  it('should accept a payload with a single-character name', () => {
    expect(isCreateTokenPayload({ name: 'x' })).toBe(true)
  })

  it('should throw on null (no null guard)', () => {
    expect(() => isCreateTokenPayload(null)).toThrow()
  })

  it('should throw on undefined (no null guard)', () => {
    expect(() => isCreateTokenPayload(undefined)).toThrow()
  })

  it('should reject when name is missing', () => {
    expect(isCreateTokenPayload({})).toBe(false)
  })

  it('should reject when name is empty', () => {
    expect(isCreateTokenPayload({ name: '' })).toBe(false)
  })

  it('should reject a non-object', () => {
    expect(isCreateTokenPayload('string')).toBe(false)
  })
})
