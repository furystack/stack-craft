import { tmpdir } from 'os'
import { join } from 'path'
import { describe, expect, it, vi } from 'vitest'

vi.mock('../../components/app-routes.js', () => ({}))

import { isImportConfigPayload } from './import-stack.js'

describe('isImportConfigPayload', () => {
  it('should accept a valid payload', () => {
    expect(isImportConfigPayload({ mainDirectory: '/home/user/stacks/my-stack' })).toBe(true)
  })

  it('should accept payload with additional env fields', () => {
    expect(
      isImportConfigPayload({
        mainDirectory: join(tmpdir(), 'stack'),
        autoSetup: 'on',
        envSource_GITHUB_TOKEN: 'inherit',
        envValue_GITHUB_TOKEN: '',
      }),
    ).toBe(true)
  })

  it('should throw on null (no null guard)', () => {
    expect(() => isImportConfigPayload(null)).toThrow()
  })

  it('should throw on undefined (no null guard)', () => {
    expect(() => isImportConfigPayload(undefined)).toThrow()
  })

  it('should reject when mainDirectory is missing', () => {
    expect(isImportConfigPayload({})).toBe(false)
  })

  it('should reject when mainDirectory is empty', () => {
    expect(isImportConfigPayload({ mainDirectory: '' })).toBe(false)
  })

  it('should reject a non-object', () => {
    expect(isImportConfigPayload('string')).toBe(false)
  })
})
