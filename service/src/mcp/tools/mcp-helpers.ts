import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import type { Injector } from '@furystack/inject'
import { z } from 'zod'

import { ProcessManager } from '../../services/process-manager.js'

export type TextResult = { content: [{ type: 'text'; text: string }]; isError?: true }

export const textResult = (text: string): TextResult => ({ content: [{ type: 'text', text }] })
export const errorResult = (text: string): TextResult => ({ content: [{ type: 'text', text }], isError: true })

export const mcpTrigger = { triggeredBy: 'mcp-user', triggerSource: 'mcp' as const }

export const environmentVariableValueSchema = z.object({
  source: z.enum(['inherit', 'custom']),
  customValue: z.string().optional(),
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
) => {
  mcp.registerTool(name, { description, inputSchema: { serviceId: z.string() } }, async ({ serviceId }) => {
    try {
      await injector.getInstance(ProcessManager)[method](serviceId, mcpTrigger)
      return textResult(`Service ${serviceId} ${pastTense}`)
    } catch (error) {
      return errorResult(`Failed: ${(error as Error).message}`)
    }
  })
}
