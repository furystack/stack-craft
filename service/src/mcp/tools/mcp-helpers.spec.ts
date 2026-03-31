import { describe, expect, it, vi } from 'vitest'

import {
  environmentVariableValueSchema,
  errorResult,
  mcpTrigger,
  registerServiceAction,
  textResult,
} from './mcp-helpers.js'

describe('textResult', () => {
  it('should wrap text into the expected content shape', () => {
    const result = textResult('hello')
    expect(result).toEqual({ content: [{ type: 'text', text: 'hello' }] })
  })

  it('should not include isError', () => {
    const result = textResult('ok')
    expect(result.isError).toBeUndefined()
  })
})

describe('errorResult', () => {
  it('should wrap text and set isError to true', () => {
    const result = errorResult('boom')
    expect(result).toEqual({
      content: [{ type: 'text', text: 'boom' }],
      isError: true,
    })
  })
})

describe('mcpTrigger', () => {
  it('should have the expected shape', () => {
    expect(mcpTrigger).toEqual({
      triggeredBy: 'mcp-user',
      triggerSource: 'mcp',
    })
  })
})

describe('environmentVariableValueSchema', () => {
  it('should accept a valid inherit source', () => {
    const result = environmentVariableValueSchema.safeParse({ source: 'inherit' })
    expect(result.success).toBe(true)
  })

  it('should accept a valid custom source with customValue', () => {
    const result = environmentVariableValueSchema.safeParse({
      source: 'custom',
      customValue: 'my-val',
      isSensitive: true,
    })
    expect(result.success).toBe(true)
  })

  it('should reject an invalid source', () => {
    const result = environmentVariableValueSchema.safeParse({ source: 'unknown' })
    expect(result.success).toBe(false)
  })

  it('should allow omitting optional fields', () => {
    const result = environmentVariableValueSchema.safeParse({ source: 'custom' })
    expect(result.success).toBe(true)
  })
})

describe('registerServiceAction', () => {
  it('should register a tool on the McpServer', () => {
    const registerTool = vi.fn()
    const mcp = { registerTool } as unknown as Parameters<typeof registerServiceAction>[0]
    const injector = {} as unknown as Parameters<typeof registerServiceAction>[3]

    registerServiceAction(mcp, 'start', 'Start a service', injector, 'startService', 'started')

    expect(registerTool).toHaveBeenCalledOnce()
    expect(registerTool).toHaveBeenCalledWith(
      'start',
      expect.objectContaining({ description: 'Start a service' }),
      expect.any(Function),
    )
  })

  it('should call the ProcessManager method and return a success result', async () => {
    const registerTool = vi.fn()
    const mcp = { registerTool } as unknown as Parameters<typeof registerServiceAction>[0]

    const startService = vi.fn().mockResolvedValue(undefined)
    const fakeProcessManager = { startService }

    const injector = {
      getInstance: vi.fn().mockReturnValue(fakeProcessManager),
    } as unknown as Parameters<typeof registerServiceAction>[3]

    registerServiceAction(mcp, 'start', 'Start a service', injector, 'startService', 'started')

    const handler = registerTool.mock.calls[0][2] as (args: { serviceId: string }) => Promise<unknown>
    const result = await handler({ serviceId: 'my-svc' })

    expect(startService).toHaveBeenCalledWith('my-svc', mcpTrigger)
    expect(result).toEqual(textResult('Service my-svc started'))
  })

  it('should return an error result when the ProcessManager method throws', async () => {
    const registerTool = vi.fn()
    const mcp = { registerTool } as unknown as Parameters<typeof registerServiceAction>[0]

    const buildService = vi.fn().mockRejectedValue(new Error('not found'))
    const fakeProcessManager = { buildService }

    const injector = {
      getInstance: vi.fn().mockReturnValue(fakeProcessManager),
    } as unknown as Parameters<typeof registerServiceAction>[3]

    registerServiceAction(mcp, 'build', 'Build a service', injector, 'buildService', 'built')

    const handler = registerTool.mock.calls[0][2] as (args: { serviceId: string }) => Promise<unknown>
    const result = await handler({ serviceId: 'bad-svc' })

    expect(result).toEqual(errorResult('Failed: not found'))
  })
})
