import { describe, expect, it } from 'vitest'
import { getHost } from './get-host.js'

describe('getHost', () => {
  it('should return 127.0.0.1 as default when no env var is set', () => {
    expect(getHost({})).toBe('127.0.0.1')
  })

  it('should return the host from APP_SERVICE_HOST env var', () => {
    expect(getHost({ APP_SERVICE_HOST: '0.0.0.0' })).toBe('0.0.0.0')
  })

  it('should return 127.0.0.1 when APP_SERVICE_HOST is empty string', () => {
    expect(getHost({ APP_SERVICE_HOST: '' })).toBe('127.0.0.1')
  })
})
