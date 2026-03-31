import { describe, expect, it } from 'vitest'

import { getMcpHost, getMcpPort } from './setup-mcp.js'

describe('getMcpPort', () => {
  it('should return 9091 as default when MCP_PORT is not set', () => {
    expect(getMcpPort({})).toBe(9091)
  })

  it('should return the port from MCP_PORT env var', () => {
    expect(getMcpPort({ MCP_PORT: '4000' })).toBe(4000)
  })
})

describe('getMcpHost', () => {
  it('should return 127.0.0.1 as default when MCP_HOST is not set', () => {
    expect(getMcpHost({})).toBe('127.0.0.1')
  })

  it('should return the host from MCP_HOST env var', () => {
    expect(getMcpHost({ MCP_HOST: '0.0.0.0' })).toBe('0.0.0.0')
  })

  it('should return 127.0.0.1 when MCP_HOST is empty string', () => {
    expect(getMcpHost({ MCP_HOST: '' })).toBe('127.0.0.1')
  })
})
