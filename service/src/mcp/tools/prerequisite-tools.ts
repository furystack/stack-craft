import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import type { Injector } from '@furystack/inject'
import { getRepository } from '@furystack/repository'
import { Prerequisite } from 'common'
import { randomUUID } from 'crypto'
import { z } from 'zod'

import { errorResult, textResult } from './mcp-helpers.js'

export const registerPrerequisiteTools = (mcp: McpServer, _injector: Injector, elevated: Injector) => {
  const repository = getRepository(elevated)

  mcp.registerTool(
    'list_prerequisites',
    {
      description: 'List prerequisites, optionally filtered by stack name',
      inputSchema: {
        stackName: z.string().optional().describe('Filter by stack name'),
      },
    },
    async ({ stackName }) => {
      const filter = stackName ? { stackName: { $eq: stackName } } : undefined
      const prereqs = await repository.getDataSetFor(Prerequisite, 'id').find(elevated, { filter })
      return textResult(JSON.stringify(prereqs, null, 2))
    },
  )

  mcp.registerTool(
    'check_prerequisite',
    { description: 'Check if a prerequisite is satisfied', inputSchema: { prerequisiteId: z.string() } },
    async ({ prerequisiteId }) => {
      const prereqs = await repository
        .getDataSetFor(Prerequisite, 'id')
        .find(elevated, { filter: { id: { $eq: prerequisiteId } }, top: 1 })
      const prereq = prereqs[0]
      if (!prereq) return errorResult('Prerequisite not found')

      const { runCheck } = await import('../../app-models/prerequisites/actions/check-prerequisite-action.js')

      try {
        const result = await runCheck(prereq.type, prereq.config)
        return result.satisfied
          ? textResult(`${prereq.name}: satisfied\n${result.output}`)
          : errorResult(`${prereq.name}: NOT satisfied\n${result.output}\n${prereq.installationHelp}`)
      } catch {
        return errorResult(`${prereq.name}: NOT satisfied\n${prereq.installationHelp}`)
      }
    },
  )

  mcp.registerTool(
    'create_prerequisite',
    {
      description: 'Create a new prerequisite for a stack',
      inputSchema: {
        id: z.string().optional().describe('UUID. Auto-generated if omitted.'),
        stackName: z.string(),
        name: z.string().describe('Human-readable name, e.g. "Node.js >= 18"'),
        type: z
          .enum([
            'node',
            'yarn',
            'dotnet-sdk',
            'dotnet-runtime',
            'nuget-feed',
            'git',
            'github-cli',
            'env-variable',
            'custom-script',
          ])
          .describe('Prerequisite type'),
        config: z
          .record(z.string(), z.unknown())
          .describe('Type-specific config (e.g. { minimumVersion: "18.0.0" })'),
        installationHelp: z.string().optional().describe('Help text shown when check fails'),
      },
    },
    async ({ id: providedId, stackName, name, type, config, installationHelp }) => {
      try {
        const now = new Date().toISOString()
        const id = providedId ?? randomUUID()
        const entry = {
          id,
          stackName,
          name,
          type,
          config,
          installationHelp: installationHelp ?? '',
          createdAt: now,
          updatedAt: now,
        }
        await repository.getDataSetFor(Prerequisite, 'id').add(elevated, entry as Prerequisite)
        return textResult(JSON.stringify(entry, null, 2))
      } catch (error) {
        return errorResult(`Failed to create prerequisite: ${(error as Error).message}`)
      }
    },
  )

  mcp.registerTool(
    'update_prerequisite',
    {
      description: 'Update a prerequisite (PATCH semantics)',
      inputSchema: {
        prerequisiteId: z.string(),
        name: z.string().optional(),
        type: z
          .enum([
            'node',
            'yarn',
            'dotnet-sdk',
            'dotnet-runtime',
            'nuget-feed',
            'git',
            'github-cli',
            'env-variable',
            'custom-script',
          ])
          .optional(),
        config: z.record(z.string(), z.unknown()).optional(),
        installationHelp: z.string().optional(),
      },
    },
    async ({ prerequisiteId, name, type, config, installationHelp }) => {
      try {
        const fields: Partial<Prerequisite> = {}
        if (name !== undefined) fields.name = name
        if (type !== undefined) fields.type = type
        if (config !== undefined) fields.config = config as Prerequisite['config']
        if (installationHelp !== undefined) fields.installationHelp = installationHelp

        if (Object.keys(fields).length > 0) {
          await repository.getDataSetFor(Prerequisite, 'id').update(elevated, prerequisiteId, fields)
        }
        return textResult(`Prerequisite ${prerequisiteId} updated`)
      } catch (error) {
        return errorResult(`Failed to update prerequisite: ${(error as Error).message}`)
      }
    },
  )

  mcp.registerTool(
    'delete_prerequisite',
    {
      description: 'Delete a prerequisite',
      inputSchema: { prerequisiteId: z.string() },
    },
    async ({ prerequisiteId }) => {
      try {
        await repository.getDataSetFor(Prerequisite, 'id').remove(elevated, prerequisiteId)
        return textResult(`Prerequisite ${prerequisiteId} deleted`)
      } catch (error) {
        return errorResult(`Failed to delete prerequisite: ${(error as Error).message}`)
      }
    },
  )
}
