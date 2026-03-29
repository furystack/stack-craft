import { describe, expect, it, vi, afterEach } from 'vitest'

import { textResult } from './mcp-helpers.js'
import { registerSystemTools } from './system-tools.js'

describe('registerSystemTools', () => {
  const originalEnv = { ...process.env }

  afterEach(() => {
    process.env = { ...originalEnv }
  })

  const setup = () => {
    const registerTool = vi.fn()
    const mcp = { registerTool } as unknown as Parameters<typeof registerSystemTools>[0]
    const injector = {} as unknown as Parameters<typeof registerSystemTools>[1]
    const elevated = {} as unknown as Parameters<typeof registerSystemTools>[2]

    registerSystemTools(mcp, injector, elevated)

    return { registerTool }
  }

  it('should register the check_env_availability tool', () => {
    const { registerTool } = setup()

    expect(registerTool).toHaveBeenCalledOnce()
    expect(registerTool).toHaveBeenCalledWith(
      'check_env_availability',
      expect.objectContaining({ description: expect.any(String) }),
      expect.any(Function),
    )
  })

  it('should report true for environment variables that are set', async () => {
    process.env.TEST_VAR_A = 'value'
    const { registerTool } = setup()

    const handler = registerTool.mock.calls[0][2] as (args: { variableNames: string[] }) => Promise<unknown>
    const result = await handler({ variableNames: ['TEST_VAR_A'] })

    expect(result).toEqual(textResult(JSON.stringify({ TEST_VAR_A: true }, null, 2)))
  })

  it('should report false for environment variables that are not set', async () => {
    delete process.env.DEFINITELY_NOT_SET
    const { registerTool } = setup()

    const handler = registerTool.mock.calls[0][2] as (args: { variableNames: string[] }) => Promise<unknown>
    const result = await handler({ variableNames: ['DEFINITELY_NOT_SET'] })

    expect(result).toEqual(textResult(JSON.stringify({ DEFINITELY_NOT_SET: false }, null, 2)))
  })

  it('should handle multiple variables at once', async () => {
    process.env.PRESENT_VAR = '1'
    delete process.env.ABSENT_VAR
    const { registerTool } = setup()

    const handler = registerTool.mock.calls[0][2] as (args: { variableNames: string[] }) => Promise<unknown>
    const result = await handler({ variableNames: ['PRESENT_VAR', 'ABSENT_VAR'] })

    expect(result).toEqual(textResult(JSON.stringify({ PRESENT_VAR: true, ABSENT_VAR: false }, null, 2)))
  })
})
