import { describe, expect, it } from 'vitest'

import { getMcpPort } from './setup-mcp.js'

describe('getMcpPort', () => {
  it('should return 9091 as default when MCP_PORT is not set', () => {
    expect(getMcpPort({})).toBe(9091)
  })

  it('should return the port from MCP_PORT env var', () => {
    expect(getMcpPort({ MCP_PORT: '4000' })).toBe(4000)
  })
})
