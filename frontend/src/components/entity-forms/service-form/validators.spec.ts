import { describe, expect, it, vi } from 'vitest'

vi.mock('../../app-routes.js', () => ({}))

import { isServiceFormPayload } from './index.js'

describe('isServiceFormPayload', () => {
  const validPayload = {
    displayName: 'My Service',
    description: 'A test service',
    workingDirectory: '',
    repositoryId: '',
    runCommand: 'npm start',
    installCommand: '',
    buildCommand: '',
    autoFetchEnabled: '',
    autoFetchIntervalMinutes: '60',
    autoRestartOnFetch: '',
  }

  it('should accept a valid payload', () => {
    expect(isServiceFormPayload(validPayload)).toBe(true)
  })

  it('should accept payload with only required fields populated', () => {
    expect(isServiceFormPayload({ displayName: 'Svc', runCommand: 'run' })).toBe(true)
  })

  it('should throw on null (no null guard)', () => {
    expect(() => isServiceFormPayload(null)).toThrow()
  })

  it('should throw on undefined (no null guard)', () => {
    expect(() => isServiceFormPayload(undefined)).toThrow()
  })

  it('should reject a non-object', () => {
    expect(isServiceFormPayload(42)).toBe(false)
  })

  it('should reject when displayName is missing', () => {
    expect(isServiceFormPayload({ runCommand: 'npm start' })).toBe(false)
  })

  it('should reject when displayName is empty', () => {
    expect(isServiceFormPayload({ ...validPayload, displayName: '' })).toBe(false)
  })

  it('should reject when runCommand is missing', () => {
    expect(isServiceFormPayload({ displayName: 'Svc' })).toBe(false)
  })

  it('should reject when runCommand is empty', () => {
    expect(isServiceFormPayload({ ...validPayload, runCommand: '' })).toBe(false)
  })

  it('should reject when both required fields are empty', () => {
    expect(isServiceFormPayload({ ...validPayload, displayName: '', runCommand: '' })).toBe(false)
  })
})
