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
      description:
        'List prerequisites (external requirements like Node.js, git, env variables). Optionally filtered by stack name.',
      inputSchema: {
        stackName: z.string().optional().describe('Filter by stack name. Returns all prerequisites if omitted.'),
      },
      annotations: { readOnlyHint: true },
    },
    async ({ stackName }) => {
      const filter = stackName ? { stackName: { $eq: stackName } } : undefined
      const prereqs = await repository.getDataSetFor(Prerequisite, 'id').find(elevated, { filter })
      return textResult(JSON.stringify(prereqs, null, 2))
    },
  )

  mcp.registerTool(
    'check_prerequisite',
    {
      description:
        'Run a live check to determine if a prerequisite is satisfied on the host system (e.g. check Node.js version, verify env variable exists). Returns the check result and installation help if not satisfied.',
      inputSchema: { prerequisiteId: z.string().describe('UUID of the prerequisite to check') },
      annotations: { readOnlyHint: true, openWorldHint: true },
    },
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
      description:
        'Create a new prerequisite for a stack. Prerequisites describe external requirements that must be satisfied before services can run.',
      inputSchema: {
        id: z.string().optional().describe('UUID primary key. Auto-generated if omitted.'),
        stackName: z.string().describe('Name of the stack this prerequisite belongs to'),
        name: z.string().describe('Human-readable name shown in the UI (e.g. "Node.js >= 18")'),
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
          .describe('Determines the check logic and the expected shape of config'),
        config: z
          .record(z.string(), z.unknown())
          .describe(
            'Type-specific configuration. Examples: { minimumVersion: "18.0.0" } for node/yarn, { version: "8.0" } for dotnet-sdk/dotnet-runtime, { feedUrl: "...", feedName?: "..." } for nuget-feed, { variableName: "...", isSensitive?: true } for env-variable, { script: "..." } for custom-script. Empty {} for git/github-cli.',
          ),
        installationHelp: z
          .string()
          .optional()
          .describe('Help text shown to the user when the prerequisite check fails (e.g. installation instructions)'),
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
      description:
        'Update a prerequisite. Uses PATCH semantics: only provided fields are updated, others are left unchanged.',
      inputSchema: {
        prerequisiteId: z.string().describe('UUID of the prerequisite to update'),
        name: z.string().optional().describe('Human-readable name shown in the UI'),
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
          .optional()
          .describe('Determines the check logic and the expected shape of config'),
        config: z
          .record(z.string(), z.unknown())
          .optional()
          .describe('Type-specific configuration. Must match the expected shape for the prerequisite type.'),
        installationHelp: z
          .string()
          .optional()
          .describe('Help text shown to the user when the prerequisite check fails'),
      },
      annotations: { idempotentHint: true },
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
      description: 'Delete a prerequisite. Also removes any service-prerequisite links that reference it.',
      inputSchema: { prerequisiteId: z.string().describe('UUID of the prerequisite to delete') },
      annotations: { destructiveHint: true },
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
