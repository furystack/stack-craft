import { tmpdir } from 'os'
import { describe, expect, it, vi } from 'vitest'

vi.mock('../app-routes.js', () => ({}))

import { isStackFormPayload } from './stack-form.js'

const TMP = tmpdir()

describe('isStackFormPayload', () => {
  const validPayload = {
    name: 'my-stack',
    displayName: 'My Stack',
    description: 'A dev stack',
    mainDirectory: '/home/user/stacks/my-stack',
  }

  it('should accept a valid payload', () => {
    expect(isStackFormPayload(validPayload)).toBe(true)
  })

  it('should accept payload without description (not validated)', () => {
    expect(isStackFormPayload({ name: 'x', displayName: 'X', mainDirectory: TMP })).toBe(true)
  })

  it('should throw on null (no null guard)', () => {
    expect(() => isStackFormPayload(null)).toThrow()
  })

  it('should throw on undefined (no null guard)', () => {
    expect(() => isStackFormPayload(undefined)).toThrow()
  })

  it('should reject when name is missing', () => {
    expect(isStackFormPayload({ displayName: 'X', mainDirectory: TMP })).toBe(false)
  })

  it('should reject when name is empty', () => {
    expect(isStackFormPayload({ ...validPayload, name: '' })).toBe(false)
  })

  it('should reject when displayName is missing', () => {
    expect(isStackFormPayload({ name: 'x', mainDirectory: TMP })).toBe(false)
  })

  it('should reject when displayName is empty', () => {
    expect(isStackFormPayload({ ...validPayload, displayName: '' })).toBe(false)
  })

  it('should reject when mainDirectory is missing', () => {
    expect(isStackFormPayload({ name: 'x', displayName: 'X' })).toBe(false)
  })

  it('should reject when mainDirectory is empty', () => {
    expect(isStackFormPayload({ ...validPayload, mainDirectory: '' })).toBe(false)
  })
})
