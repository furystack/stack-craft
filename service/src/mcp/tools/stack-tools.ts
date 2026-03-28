import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import type { Injector } from '@furystack/inject'
import { getRepository } from '@furystack/repository'
import {
  GitHubRepository,
  Prerequisite,
  ServiceConfig,
  ServiceDefinition,
  ServiceStateHistory,
  ServiceStatus,
  StackConfig,
  StackDefinition,
} from 'common'
import { randomUUID } from 'crypto'
import { z } from 'zod'

import { ProcessManager } from '../../services/process-manager.js'
import { environmentVariableValueSchema, errorResult, mcpTrigger, textResult } from './mcp-helpers.js'

export const registerStackTools = (mcp: McpServer, injector: Injector, elevated: Injector) => {
  const repository = getRepository(elevated)

  mcp.registerTool('list_stacks', { description: 'List all stacks' }, async () => {
    const defs = await repository.getDataSetFor(StackDefinition, 'name').find(elevated, {})
    const configs = await repository.getDataSetFor(StackConfig, 'stackName').find(elevated, {})
    const configMap = new Map(configs.map((c) => [c.stackName, c]))
    const stacks = defs.map((d) => ({ ...d, ...configMap.get(d.name) }))
    return textResult(JSON.stringify(stacks, null, 2))
  })

  mcp.registerTool(
    'get_stack',
    {
      description: 'Get a full stack definition with services, repositories, and prerequisites',
      inputSchema: { stackName: z.string() },
    },
    async ({ stackName }) => {
      const defs = await repository
        .getDataSetFor(StackDefinition, 'name')
        .find(elevated, { filter: { name: { $eq: stackName } }, top: 1 })
      const stack = defs[0]
      if (!stack) return errorResult(`Stack not found: ${stackName}`)

      const configs = await repository
        .getDataSetFor(StackConfig, 'stackName')
        .find(elevated, { filter: { stackName: { $eq: stackName } }, top: 1 })

      const services = await repository
        .getDataSetFor(ServiceDefinition, 'id')
        .find(elevated, { filter: { stackName: { $eq: stackName } } })
      const repos = await repository
        .getDataSetFor(GitHubRepository, 'id')
        .find(elevated, { filter: { stackName: { $eq: stackName } } })
      const prereqs = await repository
        .getDataSetFor(Prerequisite, 'id')
        .find(elevated, { filter: { stackName: { $eq: stackName } } })

      return textResult(
        JSON.stringify(
          { stack: { ...stack, ...configs[0] }, services, repositories: repos, prerequisites: prereqs },
          null,
          2,
        ),
      )
    },
  )

  mcp.registerTool(
    'create_stack',
    {
      description: 'Create a new stack with its configuration',
      inputSchema: {
        name: z.string().optional().describe('Kebab-case identifier. Auto-generated UUID if omitted.'),
        displayName: z.string().describe('Human-readable name'),
        description: z.string().optional().describe('What this stack does'),
        mainDirectory: z.string().describe('Absolute path to the root directory for services'),
        environmentVariables: z.record(z.string(), environmentVariableValueSchema).optional(),
      },
    },
    async ({ name, displayName, description, mainDirectory, environmentVariables }) => {
      try {
        const now = new Date().toISOString()
        const stackName = name ?? randomUUID()
        const def = {
          name: stackName,
          displayName,
          description: description ?? '',
          createdAt: now,
          updatedAt: now,
        }
        const config = {
          stackName,
          mainDirectory,
          environmentVariables: environmentVariables ?? {},
          createdAt: now,
          updatedAt: now,
        }
        await repository.getDataSetFor(StackDefinition, 'name').add(elevated, def)
        await repository.getDataSetFor(StackConfig, 'stackName').add(elevated, config)
        return textResult(JSON.stringify({ ...def, ...config }, null, 2))
      } catch (error) {
        return errorResult(`Failed to create stack: ${(error as Error).message}`)
      }
    },
  )

  mcp.registerTool(
    'update_stack',
    {
      description: 'Update a stack definition and/or configuration fields',
      inputSchema: {
        stackName: z.string().describe('Name of the stack to update'),
        displayName: z.string().optional(),
        description: z.string().optional(),
        mainDirectory: z.string().optional(),
        environmentVariables: z.record(z.string(), environmentVariableValueSchema).optional(),
      },
    },
    async ({ stackName, displayName, description, mainDirectory, environmentVariables }) => {
      try {
        const defFields: Partial<StackDefinition> = {}
        if (displayName !== undefined) defFields.displayName = displayName
        if (description !== undefined) defFields.description = description

        const configFields: Partial<StackConfig> = {}
        if (mainDirectory !== undefined) configFields.mainDirectory = mainDirectory
        if (environmentVariables !== undefined) configFields.environmentVariables = environmentVariables

        if (Object.keys(defFields).length > 0) {
          await repository.getDataSetFor(StackDefinition, 'name').update(elevated, stackName, defFields)
        }
        if (Object.keys(configFields).length > 0) {
          await repository.getDataSetFor(StackConfig, 'stackName').update(elevated, stackName, configFields)
        }
        return textResult(`Stack ${stackName} updated`)
      } catch (error) {
        return errorResult(`Failed to update stack: ${(error as Error).message}`)
      }
    },
  )

  mcp.registerTool(
    'delete_stack',
    {
      description: 'Delete a stack and all its services, repositories, and prerequisites',
      inputSchema: { stackName: z.string() },
    },
    async ({ stackName }) => {
      try {
        const svcDs = repository.getDataSetFor(ServiceDefinition, 'id')
        const svcs = await svcDs.find(elevated, { filter: { stackName: { $eq: stackName } }, select: ['id'] })
        const svcIds = svcs.map((svc) => svc.id)
        if (svcIds.length > 0) {
          await repository
            .getDataSetFor(ServiceStatus, 'serviceId')
            .remove(elevated, ...svcIds)
            .catch(() => {})
          await repository
            .getDataSetFor(ServiceConfig, 'serviceId')
            .remove(elevated, ...svcIds)
            .catch(() => {})
          await svcDs.remove(elevated, ...svcIds).catch(() => {})
        }

        const repos = await repository
          .getDataSetFor(GitHubRepository, 'id')
          .find(elevated, { filter: { stackName: { $eq: stackName } }, select: ['id'] })
        if (repos.length > 0) {
          await repository
            .getDataSetFor(GitHubRepository, 'id')
            .remove(elevated, ...repos.map((r) => r.id))
            .catch(() => {})
        }

        const prereqs = await repository
          .getDataSetFor(Prerequisite, 'id')
          .find(elevated, { filter: { stackName: { $eq: stackName } }, select: ['id'] })
        if (prereqs.length > 0) {
          await repository
            .getDataSetFor(Prerequisite, 'id')
            .remove(elevated, ...prereqs.map((p) => p.id))
            .catch(() => {})
        }

        await repository
          .getDataSetFor(StackConfig, 'stackName')
          .remove(elevated, stackName)
          .catch(() => {})
        await repository.getDataSetFor(StackDefinition, 'name').remove(elevated, stackName)

        return textResult(`Stack ${stackName} deleted`)
      } catch (error) {
        return errorResult(`Failed to delete stack: ${(error as Error).message}`)
      }
    },
  )

  mcp.registerTool(
    'export_stack',
    {
      description: 'Export a stack definition as shareable JSON (without timestamps)',
      inputSchema: { stackName: z.string() },
    },
    async ({ stackName }) => {
      const defs = await repository
        .getDataSetFor(StackDefinition, 'name')
        .find(elevated, { filter: { name: { $eq: stackName } }, top: 1 })
      const stack = defs[0]
      if (!stack) return errorResult(`Stack not found: ${stackName}`)

      const services = await repository
        .getDataSetFor(ServiceDefinition, 'id')
        .find(elevated, { filter: { stackName: { $eq: stackName } } })
      const repos = await repository
        .getDataSetFor(GitHubRepository, 'id')
        .find(elevated, { filter: { stackName: { $eq: stackName } } })
      const prereqs = await repository
        .getDataSetFor(Prerequisite, 'id')
        .find(elevated, { filter: { stackName: { $eq: stackName } } })

      const stripTimestamps = <T extends { createdAt?: string; updatedAt?: string }>({
        createdAt: _c,
        updatedAt: _u,
        ...rest
      }: T) => rest

      return textResult(
        JSON.stringify(
          {
            stack: stripTimestamps(stack),
            services: services.map(stripTimestamps),
            repositories: repos.map(stripTimestamps),
            prerequisites: prereqs.map(stripTimestamps),
          },
          null,
          2,
        ),
      )
    },
  )

  mcp.registerTool(
    'import_stack',
    {
      description:
        'Import a stack from an export payload. Provide the stack definition, services, repositories, prerequisites, and local config.',
      inputSchema: {
        stack: z.object({
          name: z.string(),
          displayName: z.string(),
          description: z.string().optional(),
        }),
        services: z.array(
          z.object({
            id: z.string(),
            stackName: z.string(),
            displayName: z.string(),
            description: z.string().optional(),
            workingDirectory: z.string().optional(),
            repositoryId: z.string().optional(),
            prerequisiteIds: z.array(z.string()).optional(),
            prerequisiteServiceIds: z.array(z.string()).optional(),
            installCommand: z.string().optional(),
            buildCommand: z.string().optional(),
            runCommand: z.string(),
            files: z
              .array(z.object({ relativePath: z.string(), content: z.string() }))
              .optional()
              .describe('Shared files placed relative to the service root'),
          }),
        ),
        repositories: z.array(
          z.object({
            id: z.string(),
            stackName: z.string(),
            url: z.string(),
            displayName: z.string(),
            description: z.string().optional(),
          }),
        ),
        prerequisites: z.array(
          z.object({
            id: z.string(),
            stackName: z.string(),
            name: z.string(),
            type: z.string(),
            config: z.record(z.string(), z.unknown()),
            installationHelp: z.string().optional(),
          }),
        ),
        config: z.object({
          mainDirectory: z.string(),
          environmentVariables: z.record(z.string(), environmentVariableValueSchema).optional(),
        }),
      },
    },
    async ({ stack, services, repositories, prerequisites, config }) => {
      try {
        const now = new Date().toISOString()
        const stackName = stack.name

        await repository.getDataSetFor(StackDefinition, 'name').add(elevated, {
          ...stack,
          description: stack.description ?? '',
          createdAt: now,
          updatedAt: now,
        })

        await repository.getDataSetFor(StackConfig, 'stackName').add(elevated, {
          stackName,
          mainDirectory: config.mainDirectory,
          environmentVariables: config.environmentVariables ?? {},
          createdAt: now,
          updatedAt: now,
        })

        const repoEntries = repositories.map((repo) => ({
          ...repo,
          description: repo.description ?? '',
          stackName,
          createdAt: now,
          updatedAt: now,
        }))
        if (repoEntries.length > 0) {
          await repository.getDataSetFor(GitHubRepository, 'id').add(elevated, ...repoEntries)
        }

        const prereqEntries = prerequisites.map(
          (prereq) =>
            ({
              ...prereq,
              installationHelp: prereq.installationHelp ?? '',
              stackName,
              createdAt: now,
              updatedAt: now,
            }) as Prerequisite,
        )
        if (prereqEntries.length > 0) {
          await repository.getDataSetFor(Prerequisite, 'id').add(elevated, ...prereqEntries)
        }

        const svcDefs = services.map((svc) => ({
          ...svc,
          description: svc.description ?? '',
          prerequisiteIds: svc.prerequisiteIds ?? [],
          prerequisiteServiceIds: svc.prerequisiteServiceIds ?? [],
          files: svc.files ?? [],
          stackName,
          createdAt: now,
          updatedAt: now,
        }))
        if (svcDefs.length > 0) {
          await repository.getDataSetFor(ServiceDefinition, 'id').add(elevated, ...svcDefs)
        }

        const historyDs = repository.getDataSetFor(ServiceStateHistory, 'id')
        for (const svcDef of svcDefs) {
          await repository.getDataSetFor(ServiceConfig, 'serviceId').add(elevated, {
            serviceId: svcDef.id,
            autoFetchEnabled: false,
            autoFetchIntervalMinutes: 60,
            autoRestartOnFetch: false,
            environmentVariableOverrides: {},
            createdAt: now,
            updatedAt: now,
          })

          await repository.getDataSetFor(ServiceStatus, 'serviceId').add(elevated, {
            serviceId: svcDef.id,
            cloneStatus: 'not-cloned',
            installStatus: 'not-installed',
            buildStatus: 'not-built',
            runStatus: 'stopped',
            updatedAt: now,
          })

          await historyDs.add(elevated, {
            serviceId: svcDef.id,
            event: 'imported',
            newState: JSON.stringify({
              cloneStatus: 'not-cloned',
              installStatus: 'not-installed',
              buildStatus: 'not-built',
              runStatus: 'stopped',
            }),
            triggeredBy: 'system',
            triggerSource: 'system',
            metadata: JSON.stringify({ action: 'import', stackName }),
            createdAt: now,
          })
        }

        return textResult(`Stack ${stackName} imported successfully`)
      } catch (error) {
        return errorResult(`Failed to import stack: ${(error as Error).message}`)
      }
    },
  )

  mcp.registerTool(
    'setup_stack',
    {
      description: 'Set up all services in a stack: clone, install, build',
      inputSchema: { stackName: z.string() },
    },
    async ({ stackName }) => {
      try {
        const svcDs = repository.getDataSetFor(ServiceDefinition, 'id')
        const svcs = await svcDs.find(elevated, { filter: { stackName: { $eq: stackName } }, select: ['id'] })
        if (svcs.length === 0) return errorResult(`No services found in stack: ${stackName}`)

        const pm = injector.getInstance(ProcessManager)
        await pm.setupServices(
          svcs.map((s) => s.id),
          mcpTrigger,
        )
        return textResult(`Setup started for ${svcs.length} service(s) in stack ${stackName}`)
      } catch (error) {
        return errorResult(`Failed to setup stack: ${(error as Error).message}`)
      }
    },
  )
}
