import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import type { Injector } from '@furystack/inject'
import { z } from 'zod'

import { textResult } from './mcp-helpers.js'

export const registerSystemTools = (mcp: McpServer, _injector: Injector, _elevated: Injector) => {
  mcp.registerTool(
    'check_env_availability',
    {
      description: 'Check if environment variables are available on the host system',
      inputSchema: {
        variableNames: z.array(z.string()).describe('List of environment variable names to check'),
      },
    },
    async ({ variableNames }) => {
      const result: Record<string, boolean> = {}
      for (const name of variableNames) {
        result[name] = process.env[name] !== undefined
      }
      return textResult(JSON.stringify(result, null, 2))
    },
  )
}
