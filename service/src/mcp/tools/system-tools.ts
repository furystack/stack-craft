import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import type { Injector } from '@furystack/inject'
import { getLogger } from '@furystack/logging'
import { z } from 'zod'

import { textResult } from './mcp-helpers.js'

export const registerSystemTools = (mcp: McpServer, injector: Injector, _elevated: Injector) => {
  const logger = getLogger(injector).withScope('McpSystemTools')

  mcp.registerTool(
    'check_env_availability',
    {
      description:
        'Check if environment variables are defined on the host system. Returns a map of variable name to boolean (true = defined, false = not defined). Does not reveal values.',
      inputSchema: {
        variableNames: z
          .array(z.string())
          .describe('List of environment variable names to check (e.g. ["NODE_ENV", "DATABASE_URL"])'),
      },
      annotations: { readOnlyHint: true },
    },
    async ({ variableNames }) => {
      await logger.verbose({
        message: 'check_env_availability called',
        data: { variableNames },
      })
      const result: Record<string, boolean> = {}
      for (const name of variableNames) {
        result[name] = process.env[name] !== undefined
      }
      return textResult(JSON.stringify(result, null, 2))
    },
  )
}
