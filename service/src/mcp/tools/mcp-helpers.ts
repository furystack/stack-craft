import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import type { ToolAnnotations } from '@modelcontextprotocol/sdk/types.js'
import type { Injector } from '@furystack/inject'
import { z } from 'zod'

import { ProcessManager } from '../../services/process-manager.js'

export type TextResult = { content: [{ type: 'text'; text: string }]; isError?: true }

export const textResult = (text: string): TextResult => ({ content: [{ type: 'text', text }] })
export const errorResult = (text: string): TextResult => ({ content: [{ type: 'text', text }], isError: true })

export const mcpTrigger = { triggeredBy: 'mcp-user', triggerSource: 'mcp' as const }

export const environmentVariableValueSchema = z.object({
  source: z
    .enum(['inherit', 'custom'])
    .describe("'inherit' uses the value from the host system environment; 'custom' uses the provided customValue"),
  customValue: z
    .string()
    .optional()
    .describe("The value to use when source is 'custom'. Ignored when source is 'inherit'."),
  isSensitive: z.boolean().optional().describe('When true, the value is encrypted at rest and masked in API responses'),
})

export const registerServiceAction = (
  mcp: McpServer,
  name: string,
  description: string,
  injector: Injector,
  method: keyof Pick<
    ProcessManager,
    | 'startService'
    | 'stopService'
    | 'restartService'
    | 'installService'
    | 'buildService'
    | 'setupService'
    | 'updateService'
  >,
  pastTense: string,
  annotations?: ToolAnnotations,
) => {
  mcp.registerTool(
    name,
    {
      description,
      inputSchema: { serviceId: z.string().describe('UUID of the target service') },
      annotations,
    },
    async ({ serviceId }) => {
      try {
        await injector.get(ProcessManager)[method](serviceId, mcpTrigger)
        return textResult(`Service ${serviceId} ${pastTense}`)
      } catch (error) {
        return errorResult(`Failed: ${(error as Error).message}`)
      }
    },
  )
}
