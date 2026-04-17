import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import type { Injector } from '@furystack/inject'
import { getLogger } from '@furystack/logging'
import { getRepository } from '@furystack/repository'
import {
  GitHubRepository,
  Prerequisite,
  ServiceConfig,
  ServiceDefinition,
  ServiceDependencyLink,
  ServicePrerequisiteLink,
  ServiceStateHistory,
  ServiceStatus,
  StackConfig,
  StackDefinition,
} from 'common'
import { randomUUID } from 'crypto'
import { z } from 'zod'

import { ProcessManager } from '../../services/process-manager.js'
import { CryptoService } from '../../utils/crypto-service.js'
import { encryptEnvValues } from '../../utils/env-encryption-helpers.js'
import { environmentVariableValueSchema, errorResult, mcpTrigger, textResult } from './mcp-helpers.js'

export const registerStackTools = (mcp: McpServer, injector: Injector, elevated: Injector) => {
  const repository = getRepository(elevated)
  const logger = getLogger(elevated).withScope('MCP:StackTools')

  mcp.registerTool(
    'list_stacks',
    {
      description: 'List all stacks with their definitions and configuration (mainDirectory, environment variables).',
      annotations: { readOnlyHint: true },
    },
    async () => {
      const defs = await repository.getDataSetFor(StackDefinition, 'name').find(elevated, {})
      const configs = await repository.getDataSetFor(StackConfig, 'stackName').find(elevated, {})
      const configMap = new Map(configs.map((c) => [c.stackName, c]))
      const stacks = defs.map((d) => ({ ...d, ...configMap.get(d.name) }))
      return textResult(JSON.stringify(stacks, null, 2))
    },
  )

  mcp.registerTool(
    'get_stack',
    {
      description: 'Get a full stack definition including its config, all services, repositories, and prerequisites.',
      inputSchema: { stackName: z.string().describe('Unique name (kebab-case identifier) of the stack') },
      annotations: { readOnlyHint: true },
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
      description:
        'Create a new stack with its configuration. A stack is a logical grouping of services, repositories, and prerequisites.',
      inputSchema: {
        name: z
          .string()
          .optional()
          .describe('Kebab-case identifier used as the primary key. Auto-generated UUID if omitted.'),
        displayName: z.string().describe('Human-readable name shown in the UI'),
        description: z.string().optional().describe('What this stack does'),
        mainDirectory: z
          .string()
          .describe('Absolute path to the root directory where service repositories will be cloned'),
        environmentVariables: z
          .record(z.string(), environmentVariableValueSchema)
          .optional()
          .describe(
            'Stack-level environment variables, keyed by variable name. Services inherit these unless overridden.',
          ),
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
      description:
        'Update a stack definition and/or configuration fields. Uses PATCH semantics: only provided fields are updated. For fine-grained env variable management, use set_stack_env_variable / remove_stack_env_variable instead.',
      inputSchema: {
        stackName: z.string().describe('Name of the stack to update'),
        displayName: z.string().optional().describe('Human-readable name shown in the UI'),
        description: z.string().optional().describe('What this stack does'),
        mainDirectory: z
          .string()
          .optional()
          .describe('Absolute path to the root directory where service repositories will be cloned'),
        environmentVariables: z
          .record(z.string(), environmentVariableValueSchema)
          .optional()
          .describe('Fully replaces all stack-level environment variables when provided.'),
      },
      annotations: { idempotentHint: true },
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
      description:
        'Delete a stack and all its associated data: services (with their configs and statuses), repositories, and prerequisites. Does not remove cloned files from disk.',
      inputSchema: { stackName: z.string().describe('Name of the stack to delete') },
      annotations: { destructiveHint: true },
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
            .catch(
              (e) =>
                void logger.warning({
                  message: 'Failed to remove service statuses during stack delete',
                  data: { stackName, error: e },
                }),
            )
          await repository
            .getDataSetFor(ServiceConfig, 'serviceId')
            .remove(elevated, ...svcIds)
            .catch(
              (e) =>
                void logger.warning({
                  message: 'Failed to remove service configs during stack delete',
                  data: { stackName, error: e },
                }),
            )
          await svcDs.remove(elevated, ...svcIds).catch(
            (e) =>
              void logger.warning({
                message: 'Failed to remove service definitions during stack delete',
                data: { stackName, error: e },
              }),
          )
        }

        const repos = await repository
          .getDataSetFor(GitHubRepository, 'id')
          .find(elevated, { filter: { stackName: { $eq: stackName } }, select: ['id'] })
        if (repos.length > 0) {
          await repository
            .getDataSetFor(GitHubRepository, 'id')
            .remove(elevated, ...repos.map((r) => r.id))
            .catch(
              (e) =>
                void logger.warning({
                  message: 'Failed to remove repositories during stack delete',
                  data: { stackName, error: e },
                }),
            )
        }

        const prereqs = await repository
          .getDataSetFor(Prerequisite, 'id')
          .find(elevated, { filter: { stackName: { $eq: stackName } }, select: ['id'] })
        if (prereqs.length > 0) {
          await repository
            .getDataSetFor(Prerequisite, 'id')
            .remove(elevated, ...prereqs.map((p) => p.id))
            .catch(
              (e) =>
                void logger.warning({
                  message: 'Failed to remove prerequisites during stack delete',
                  data: { stackName, error: e },
                }),
            )
        }

        await repository
          .getDataSetFor(StackConfig, 'stackName')
          .remove(elevated, stackName)
          .catch(
            (e) =>
              void logger.warning({
                message: 'Failed to remove stack config during stack delete',
                data: { stackName, error: e },
              }),
          )
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
      description:
        'Export a stack definition as shareable JSON. Includes the stack definition, services, repositories, and prerequisites. Strips timestamps and nullish fields. Does not include user-specific config (mainDirectory, env variable values, local files).',
      inputSchema: { stackName: z.string().describe('Name of the stack to export') },
      annotations: { readOnlyHint: true },
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

      const stripNullish = <T extends Record<string, unknown>>(obj: T): T =>
        Object.fromEntries(Object.entries(obj).filter(([, v]) => v != null)) as T

      return textResult(
        JSON.stringify(
          {
            stack: stripNullish(stripTimestamps(stack)),
            services: services.map((s) => stripNullish(stripTimestamps(s))),
            repositories: repos.map((r) => stripNullish(stripTimestamps(r))),
            prerequisites: prereqs.map((p) => stripNullish(stripTimestamps(p))),
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
        'Import a stack from an export payload. Creates all entities (stack, services, repositories, prerequisites) and initializes each service in not-cloned/not-installed/not-built/stopped state. Rolls back on failure.',
      inputSchema: {
        stack: z
          .object({
            name: z.string().describe('Kebab-case stack identifier'),
            displayName: z.string().describe('Human-readable name'),
            description: z.string().optional().describe('What this stack does'),
          })
          .describe('Stack definition (from export_stack output)'),
        services: z
          .array(
            z.object({
              id: z.string().describe('UUID, must match IDs used in prerequisiteServiceIds references'),
              stackName: z.string().describe('Must match stack.name'),
              displayName: z.string().describe('Human-readable name'),
              description: z.string().optional(),
              workingDirectory: z.string().optional().describe('Relative path within the stack mainDirectory'),
              repositoryId: z.string().optional().describe('UUID of a repository entry in the repositories array'),
              prerequisiteIds: z
                .array(z.string())
                .optional()
                .describe('UUIDs of prerequisite entries in the prerequisites array'),
              prerequisiteServiceIds: z
                .array(z.string())
                .optional()
                .describe('UUIDs of other services in this array that must be set up first'),
              installCommand: z.string().optional().describe('Shell command to install dependencies'),
              buildCommand: z.string().optional().describe('Shell command to build the service'),
              runCommand: z.string().describe('Shell command to start the service'),
              files: z
                .array(
                  z.object({
                    relativePath: z.string().describe('Path relative to the service working directory'),
                    content: z.string().describe('File content'),
                  }),
                )
                .optional()
                .describe('Shared files placed relative to the service root'),
            }),
          )
          .describe('Service definitions (from export_stack output)'),
        repositories: z
          .array(
            z.object({
              id: z.string().describe('UUID, referenced by services via repositoryId'),
              stackName: z.string().describe('Must match stack.name'),
              url: z.string().describe('Full git URL (e.g. "https://github.com/user/repo")'),
              displayName: z.string().describe('Human-readable name'),
              description: z.string().optional(),
            }),
          )
          .describe('GitHub repository entries (from export_stack output)'),
        prerequisites: z
          .array(
            z.object({
              id: z.string().describe('UUID, referenced by services via prerequisiteIds'),
              stackName: z.string().describe('Must match stack.name'),
              name: z.string().describe('Human-readable name (e.g. "Node.js >= 18")'),
              type: z.string().describe('Prerequisite type (e.g. "node", "git", "env-variable", "custom-script")'),
              config: z.record(z.string(), z.unknown()).describe('Type-specific configuration'),
              installationHelp: z.string().optional().describe('Help text shown when the check fails'),
            }),
          )
          .describe('Prerequisite entries (from export_stack output)'),
        config: z
          .object({
            mainDirectory: z
              .string()
              .describe('Absolute path to the root directory where service repositories will be cloned'),
            environmentVariables: z
              .record(z.string(), environmentVariableValueSchema)
              .optional()
              .describe('Stack-level environment variables for this installation'),
          })
          .describe('Installation-specific configuration (not present in export, must be provided by the user)'),
      },
    },
    async ({ stack, services, repositories, prerequisites, config }) => {
      const now = new Date().toISOString()
      const stackName = stack.name
      const crypto = elevated.getInstance(CryptoService)

      const repoEntries = repositories.map((repo) => ({
        ...repo,
        description: repo.description ?? '',
        stackName,
        createdAt: now,
        updatedAt: now,
      }))

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

      const svcDefs = services.map((svc) => ({
        ...svc,
        description: svc.description ?? '',
        files: svc.files ?? [],
        stackName,
        createdAt: now,
        updatedAt: now,
      }))

      const stackDefDs = repository.getDataSetFor(StackDefinition, 'name')
      const stackConfigDs = repository.getDataSetFor(StackConfig, 'stackName')
      const repoDs = repository.getDataSetFor(GitHubRepository, 'id')
      const prereqDs = repository.getDataSetFor(Prerequisite, 'id')
      const svcDefDs = repository.getDataSetFor(ServiceDefinition, 'id')
      const svcConfigDs = repository.getDataSetFor(ServiceConfig, 'serviceId')
      const svcStatusDs = repository.getDataSetFor(ServiceStatus, 'serviceId')
      const historyDs = repository.getDataSetFor(ServiceStateHistory, 'id')

      try {
        await stackDefDs.add(elevated, {
          ...stack,
          description: stack.description ?? '',
          createdAt: now,
          updatedAt: now,
        })

        await stackConfigDs.add(elevated, {
          stackName,
          mainDirectory: config.mainDirectory,
          environmentVariables: encryptEnvValues(crypto, config.environmentVariables ?? {}),
          createdAt: now,
          updatedAt: now,
        })

        if (repoEntries.length > 0) {
          await repoDs.add(elevated, ...repoEntries)
        }
        if (prereqEntries.length > 0) {
          await prereqDs.add(elevated, ...prereqEntries)
        }
        if (svcDefs.length > 0) {
          await svcDefDs.add(elevated, ...svcDefs)
        }

        const prereqLinkDs = repository.getDataSetFor(ServicePrerequisiteLink, 'id')
        const depLinkDs = repository.getDataSetFor(ServiceDependencyLink, 'id')
        for (const svc of services) {
          for (const prereqId of svc.prerequisiteIds ?? []) {
            await prereqLinkDs.add(elevated, {
              id: `${svc.id}::${prereqId}`,
              serviceId: svc.id,
              prerequisiteId: prereqId,
            })
          }
          for (const depId of svc.prerequisiteServiceIds ?? []) {
            await depLinkDs.add(elevated, {
              id: `${svc.id}::${depId}`,
              serviceId: svc.id,
              dependsOnServiceId: depId,
            })
          }
        }

        for (const svcDef of svcDefs) {
          await svcConfigDs.add(elevated, {
            serviceId: svcDef.id,
            autoFetchEnabled: false,
            autoFetchIntervalMinutes: 60,
            autoRestartOnFetch: false,
            environmentVariableOverrides: {},
            localFiles: [],
            createdAt: now,
            updatedAt: now,
          })

          await svcStatusDs.add(elevated, {
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
        const svcIds = svcDefs.map((s) => s.id)
        for (const svcId of svcIds) {
          const historyEntries = await historyDs
            .find(elevated, { filter: { serviceId: { $eq: svcId } } })
            .catch(() => [] as ServiceStateHistory[])
          if (historyEntries.length > 0) {
            await historyDs.remove(elevated, ...historyEntries.map((e) => e.id)).catch(
              (e) =>
                void logger.warning({
                  message: 'Rollback: failed to remove history entries',
                  data: { stackName, error: e },
                }),
            )
          }
        }
        if (svcIds.length > 0) {
          await svcStatusDs.remove(elevated, ...svcIds).catch(
            (e) =>
              void logger.warning({
                message: 'Rollback: failed to remove service statuses',
                data: { stackName, error: e },
              }),
          )
          await svcConfigDs.remove(elevated, ...svcIds).catch(
            (e) =>
              void logger.warning({
                message: 'Rollback: failed to remove service configs',
                data: { stackName, error: e },
              }),
          )
          await svcDefDs.remove(elevated, ...svcIds).catch(
            (e) =>
              void logger.warning({
                message: 'Rollback: failed to remove service definitions',
                data: { stackName, error: e },
              }),
          )
        }
        if (prereqEntries.length > 0) {
          await prereqDs.remove(elevated, ...prereqEntries.map((p) => p.id)).catch(
            (e) =>
              void logger.warning({
                message: 'Rollback: failed to remove prerequisites',
                data: { stackName, error: e },
              }),
          )
        }
        if (repoEntries.length > 0) {
          await repoDs.remove(elevated, ...repoEntries.map((r) => r.id)).catch(
            (e) =>
              void logger.warning({
                message: 'Rollback: failed to remove repositories',
                data: { stackName, error: e },
              }),
          )
        }
        await stackConfigDs.remove(elevated, stackName).catch(
          (e) =>
            void logger.warning({
              message: 'Rollback: failed to remove stack config',
              data: { stackName, error: e },
            }),
        )
        await stackDefDs.remove(elevated, stackName).catch(
          (e) =>
            void logger.warning({
              message: 'Rollback: failed to remove stack definition',
              data: { stackName, error: e },
            }),
        )

        return errorResult(`Failed to import stack: ${(error as Error).message}`)
      }
    },
  )

  mcp.registerTool(
    'setup_stack',
    {
      description:
        'Run the full setup pipeline for all services in a stack: clone, install, build. Services are executed in dependency order based on prerequisiteServiceIds (topological sort). Circular dependencies are run in parallel.',
      inputSchema: { stackName: z.string().describe('Name of the stack to set up') },
      annotations: { openWorldHint: true },
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
