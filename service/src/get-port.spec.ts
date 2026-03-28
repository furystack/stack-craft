import { describe, expect, it } from 'vitest'
import { getPort } from './get-port.js'

describe('getPort', () => {
  it('should return 9090 as default when no env var is set', () => {
    expect(getPort({})).toBe(9090)
  })

  it('should return the port from APP_SERVICE_PORT env var', () => {
    expect(getPort({ APP_SERVICE_PORT: '3000' })).toBe(3000)
  })

  it('should return 9090 when APP_SERVICE_PORT is not a valid number', () => {
    expect(getPort({ APP_SERVICE_PORT: 'invalid' })).toBe(9090)
  })
})
