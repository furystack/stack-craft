import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import type { Injector } from '@furystack/inject'
import { getLogger } from '@furystack/logging'
import {
  ServiceConfig,
  ServiceDefinition,
  ServiceDependencyLink,
  ServicePrerequisiteLink,
  ServiceStateHistory,
  ServiceStatus,
} from 'common'
import { randomUUID } from 'crypto'
import { z } from 'zod'

import { LogStorageService } from '../../services/log-storage-service.js'
import { ProcessManager } from '../../services/process-manager.js'
import { CryptoService } from '../../utils/crypto-service.js'
import { encryptEnvValues } from '../../utils/env-encryption-helpers.js'
import {
  environmentVariableValueSchema,
  errorResult,
  mcpTrigger,
  registerServiceAction,
  textResult,
} from './mcp-helpers.js'
import { legacyRepository as getRepository } from '../../utils/legacy-repository.js'

export const registerServiceTools = (mcp: McpServer, injector: Injector, elevated: Injector) => {
  const repository = getRepository(elevated)
  const logger = getLogger(elevated).withScope('MCP:ServiceTools')

  mcp.registerTool(
    'list_services',
    {
      description:
        'List all services in a stack with their current status. Returns id, displayName, cloneStatus, runStatus, installStatus, and buildStatus for each service.',
      inputSchema: { stackName: z.string().describe('Name of the stack to list services for') },
      annotations: { readOnlyHint: true },
    },
    async ({ stackName }) => {
      const services = await repository
        .getDataSetFor(ServiceDefinition, 'id')
        .find(elevated, { filter: { stackName: { $eq: stackName } } })
      const statuses = await repository.getDataSetFor(ServiceStatus, 'serviceId').find(elevated, {})
      const statusMap = new Map(statuses.map((s) => [s.serviceId, s]))

      const summary = services.map((s) => {
        const st = statusMap.get(s.id)
        return {
          id: s.id,
          displayName: s.displayName,
          cloneStatus: st?.cloneStatus ?? 'not-cloned',
          runStatus: st?.runStatus ?? 'stopped',
          installStatus: st?.installStatus ?? 'not-installed',
          buildStatus: st?.buildStatus ?? 'not-built',
        }
      })
      return textResult(JSON.stringify(summary, null, 2))
    },
  )

  registerServiceAction(
    mcp,
    'start_service',
    'Start a service by running its configured runCommand. Fails if the service is already running.',
    injector,
    'startService',
    'started',
  )
  registerServiceAction(
    mcp,
    'stop_service',
    'Stop a running service process. No-op if the service is already stopped.',
    injector,
    'stopService',
    'stopped',
    { idempotentHint: true },
  )
  registerServiceAction(
    mcp,
    'restart_service',
    'Restart a service: stops the current process and starts it again. If the service is not running, starts it.',
    injector,
    'restartService',
    'restarted',
  )
  registerServiceAction(
    mcp,
    'install_service',
    'Run the service installCommand (e.g. "npm install"). Requires the repository to be cloned first.',
    injector,
    'installService',
    'installed',
  )
  registerServiceAction(
    mcp,
    'build_service',
    'Run the service buildCommand (e.g. "npm run build"). Requires dependencies to be installed first.',
    injector,
    'buildService',
    'built',
  )
  registerServiceAction(
    mcp,
    'setup_service',
    'Full setup pipeline for a single service: clone repository, install dependencies, build. Each step is skipped if already completed.',
    injector,
    'setupService',
    'set up',
  )
  registerServiceAction(
    mcp,
    'update_service',
    'Update a service: pull latest changes from git, reinstall dependencies, rebuild, and restart if the service was previously running.',
    injector,
    'updateService',
    'updated',
    { openWorldHint: true },
  )

  mcp.registerTool(
    'get_service_logs',
    {
      description:
        'Get recent stdout/stderr log output for a service process. Returns the most recent lines in chronological order.',
      inputSchema: {
        serviceId: z.string().describe('UUID of the service to get logs for'),
        lines: z.number().optional().default(100).describe('Number of recent log lines to return (default: 100)'),
      },
      annotations: { readOnlyHint: true },
    },
    async ({ serviceId, lines }) => {
      const entries = await injector.get(LogStorageService).getEntries(serviceId, { limit: lines })
      const logLines = entries.reverse().map((e) => e.line)
      return textResult(logLines.join('\n') || '(no logs)')
    },
  )

  mcp.registerTool(
    'pull_service',
    {
      description:
        'Clone the git repository if not yet cloned, or pull latest changes if already cloned. Requires the service to have an associated repository.',
      inputSchema: { serviceId: z.string().describe('UUID of the service whose repository to clone or pull') },
      annotations: { openWorldHint: true },
    },
    async ({ serviceId }) => {
      try {
        const result = await injector.get(ProcessManager).cloneOrPullService(serviceId, mcpTrigger)
        if (result.cloned) return textResult('Repository cloned')
        return textResult(result.updated ? 'Changes pulled' : 'Already up to date')
      } catch (error) {
        return errorResult(`Failed: ${(error as Error).message}`)
      }
    },
  )

  mcp.registerTool(
    'create_service',
    {
      description:
        'Create a new service in a stack. Creates the service definition, configuration, and an initial status record. The service starts in not-cloned/not-installed/not-built/stopped state.',
      inputSchema: {
        id: z.string().optional().describe('UUID primary key. Auto-generated if omitted.'),
        stackName: z.string().describe('Name of the stack this service belongs to'),
        displayName: z.string().describe('Human-readable name shown in the UI'),
        description: z.string().optional().describe('What this service does'),
        workingDirectory: z
          .string()
          .optional()
          .describe('Relative path within the stack mainDirectory (e.g. "frontends/public"). Used for grouping.'),
        repositoryId: z.string().optional().describe('UUID of a GitHubRepository entry to clone for this service'),
        prerequisiteIds: z
          .array(z.string())
          .optional()
          .describe(
            'UUIDs of Prerequisite entries (e.g. Node.js version, env variable checks) that must be satisfied before this service can run',
          ),
        prerequisiteServiceIds: z
          .array(z.string())
          .optional()
          .describe(
            'UUIDs of other services that must be set up before this one during batch setup. Used for topological ordering. Circular dependencies are allowed and result in parallel execution.',
          ),
        installCommand: z.string().optional().describe('Shell command to install dependencies (e.g. "npm install")'),
        buildCommand: z.string().optional().describe('Shell command to build the service (e.g. "npm run build")'),
        runCommand: z.string().describe('Shell command to start the service (e.g. "npm start")'),
        files: z
          .array(
            z.object({
              relativePath: z.string().describe('Path relative to the service working directory'),
              content: z.string().describe('File content (plain text)'),
            }),
          )
          .optional()
          .describe(
            'Shared files placed relative to the service root. Included in exports. Use local files (via add_local_file) for secrets.',
          ),
        autoFetchEnabled: z
          .boolean()
          .optional()
          .describe('Enable periodic git fetch in the background (default: false)'),
        autoFetchIntervalMinutes: z.number().optional().describe('Minutes between automatic git fetches (default: 60)'),
        autoRestartOnFetch: z
          .boolean()
          .optional()
          .describe('Automatically restart the service when new commits are fetched (default: false)'),
        environmentVariableOverrides: z
          .record(z.string(), environmentVariableValueSchema)
          .optional()
          .describe(
            'Per-service environment variable overrides, keyed by variable name. Overrides stack-level defaults for this service.',
          ),
      },
    },
    async ({
      id: providedId,
      stackName,
      displayName,
      description,
      workingDirectory,
      repositoryId,
      prerequisiteIds,
      prerequisiteServiceIds,
      installCommand,
      buildCommand,
      runCommand,
      files,
      autoFetchEnabled,
      autoFetchIntervalMinutes,
      autoRestartOnFetch,
      environmentVariableOverrides,
    }) => {
      try {
        const now = new Date().toISOString()
        const id = providedId ?? randomUUID()

        const resolvedPrereqIds = prerequisiteIds ?? []
        const resolvedDepIds = prerequisiteServiceIds ?? []

        const def = {
          id,
          stackName,
          displayName,
          description: description ?? '',
          workingDirectory,
          repositoryId,
          installCommand,
          buildCommand,
          runCommand,
          files: files ?? [],
          createdAt: now,
          updatedAt: now,
        }

        const crypto = elevated.get(CryptoService)
        const config = {
          serviceId: id,
          autoFetchEnabled: autoFetchEnabled ?? false,
          autoFetchIntervalMinutes: autoFetchIntervalMinutes ?? 60,
          autoRestartOnFetch: autoRestartOnFetch ?? false,
          environmentVariableOverrides: encryptEnvValues(crypto, environmentVariableOverrides ?? {}),
          localFiles: [],
          createdAt: now,
          updatedAt: now,
        }

        const status = {
          serviceId: id,
          cloneStatus: 'not-cloned' as const,
          installStatus: 'not-installed' as const,
          buildStatus: 'not-built' as const,
          runStatus: 'stopped' as const,
          updatedAt: now,
        }

        await repository.getDataSetFor(ServiceDefinition, 'id').add(elevated, def)
        await repository.getDataSetFor(ServiceConfig, 'serviceId').add(elevated, config)
        await repository.getDataSetFor(ServiceStatus, 'serviceId').add(elevated, status)

        const prereqDs = repository.getDataSetFor(ServicePrerequisiteLink, 'id')
        const depDs = repository.getDataSetFor(ServiceDependencyLink, 'id')
        for (const prereqId of resolvedPrereqIds) {
          await prereqDs.add(elevated, { id: `${id}::${prereqId}`, serviceId: id, prerequisiteId: prereqId })
        }
        for (const depId of resolvedDepIds) {
          await depDs.add(elevated, { id: `${id}::${depId}`, serviceId: id, dependsOnServiceId: depId })
        }

        return textResult(
          JSON.stringify(
            {
              ...def,
              ...config,
              ...status,
              prerequisiteIds: resolvedPrereqIds,
              prerequisiteServiceIds: resolvedDepIds,
            },
            null,
            2,
          ),
        )
      } catch (error) {
        return errorResult(`Failed to create service: ${(error as Error).message}`)
      }
    },
  )

  mcp.registerTool(
    'edit_service',
    {
      description:
        'Update a service definition and/or configuration fields. Uses PATCH semantics: only provided fields are updated, others are left unchanged. When prerequisiteIds or prerequisiteServiceIds are provided, they fully replace the existing set.',
      inputSchema: {
        serviceId: z.string().describe('UUID of the service to edit'),
        displayName: z.string().optional().describe('Human-readable name shown in the UI'),
        description: z.string().optional().describe('What this service does'),
        workingDirectory: z
          .string()
          .optional()
          .describe('Relative path within the stack mainDirectory (e.g. "frontends/public")'),
        repositoryId: z.string().optional().describe('UUID of a GitHubRepository entry to clone for this service'),
        prerequisiteIds: z
          .array(z.string())
          .optional()
          .describe(
            'Full replacement set of Prerequisite UUIDs. Existing links are removed and replaced with this list.',
          ),
        prerequisiteServiceIds: z
          .array(z.string())
          .optional()
          .describe(
            'Full replacement set of service dependency UUIDs. Controls batch setup ordering. Circular dependencies are allowed and result in parallel execution.',
          ),
        installCommand: z.string().optional().describe('Shell command to install dependencies (e.g. "npm install")'),
        buildCommand: z.string().optional().describe('Shell command to build the service (e.g. "npm run build")'),
        runCommand: z.string().optional().describe('Shell command to start the service (e.g. "npm start")'),
        files: z
          .array(
            z.object({
              relativePath: z.string().describe('Path relative to the service working directory'),
              content: z.string().describe('File content (plain text)'),
            }),
          )
          .optional()
          .describe('Full replacement set of shared files. All existing shared files are replaced.'),
        autoFetchEnabled: z.boolean().optional().describe('Enable periodic git fetch in the background'),
        autoFetchIntervalMinutes: z.number().optional().describe('Minutes between automatic git fetches'),
        autoRestartOnFetch: z
          .boolean()
          .optional()
          .describe('Automatically restart the service when new commits are fetched'),
        environmentVariableOverrides: z
          .record(z.string(), environmentVariableValueSchema)
          .optional()
          .describe('Per-service environment variable overrides. Fully replaces existing overrides when provided.'),
      },
      annotations: { idempotentHint: true },
    },
    async ({
      serviceId,
      displayName,
      description,
      workingDirectory,
      repositoryId,
      prerequisiteIds,
      prerequisiteServiceIds,
      installCommand,
      buildCommand,
      runCommand,
      files,
      autoFetchEnabled,
      autoFetchIntervalMinutes,
      autoRestartOnFetch,
      environmentVariableOverrides,
    }) => {
      try {
        const defFields: Partial<ServiceDefinition> = {}
        if (displayName !== undefined) defFields.displayName = displayName
        if (description !== undefined) defFields.description = description
        if (workingDirectory !== undefined) defFields.workingDirectory = workingDirectory
        if (repositoryId !== undefined) defFields.repositoryId = repositoryId
        if (installCommand !== undefined) defFields.installCommand = installCommand
        if (buildCommand !== undefined) defFields.buildCommand = buildCommand
        if (runCommand !== undefined) defFields.runCommand = runCommand
        if (files !== undefined) defFields.files = files

        const configFields: Partial<ServiceConfig> = {}
        if (autoFetchEnabled !== undefined) configFields.autoFetchEnabled = autoFetchEnabled
        if (autoFetchIntervalMinutes !== undefined) configFields.autoFetchIntervalMinutes = autoFetchIntervalMinutes
        if (autoRestartOnFetch !== undefined) configFields.autoRestartOnFetch = autoRestartOnFetch
        if (environmentVariableOverrides !== undefined) {
          const crypto = elevated.get(CryptoService)
          const existing = (
            await repository
              .getDataSetFor(ServiceConfig, 'serviceId')
              .find(elevated, { filter: { serviceId: { $eq: serviceId } }, top: 1 })
          )[0]
          configFields.environmentVariableOverrides = encryptEnvValues(
            crypto,
            environmentVariableOverrides,
            existing?.environmentVariableOverrides,
          )
        }

        if (Object.keys(defFields).length > 0) {
          await repository.getDataSetFor(ServiceDefinition, 'id').update(elevated, serviceId, defFields)
        }
        if (Object.keys(configFields).length > 0) {
          await repository.getDataSetFor(ServiceConfig, 'serviceId').update(elevated, serviceId, configFields)
        }

        if (prerequisiteIds !== undefined) {
          const prereqDs = repository.getDataSetFor(ServicePrerequisiteLink, 'id')
          const existing = await prereqDs.find(elevated, { filter: { serviceId: { $eq: serviceId } } })
          if (existing.length > 0) await prereqDs.remove(elevated, ...existing.map((l) => l.id))
          for (const prereqId of prerequisiteIds) {
            await prereqDs.add(elevated, {
              id: `${serviceId}::${prereqId}`,
              serviceId,
              prerequisiteId: prereqId,
            })
          }
        }
        if (prerequisiteServiceIds !== undefined) {
          const depDs = repository.getDataSetFor(ServiceDependencyLink, 'id')
          const existing = await depDs.find(elevated, { filter: { serviceId: { $eq: serviceId } } })
          if (existing.length > 0) await depDs.remove(elevated, ...existing.map((l) => l.id))
          for (const depId of prerequisiteServiceIds) {
            await depDs.add(elevated, {
              id: `${serviceId}::${depId}`,
              serviceId,
              dependsOnServiceId: depId,
            })
          }
        }

        return textResult(`Service ${serviceId} updated`)
      } catch (error) {
        return errorResult(`Failed to edit service: ${(error as Error).message}`)
      }
    },
  )

  mcp.registerTool(
    'delete_service',
    {
      description:
        'Delete a service and all its associated data (config, status records). Does not remove cloned files from disk.',
      inputSchema: { serviceId: z.string().describe('UUID of the service to delete') },
      annotations: { destructiveHint: true },
    },
    async ({ serviceId }) => {
      try {
        await repository
          .getDataSetFor(ServiceStatus, 'serviceId')
          .remove(elevated, serviceId)
          .catch(
            (e) =>
              void logger.warning({
                message: 'Failed to remove service status during delete',
                data: { serviceId, error: e },
              }),
          )
        await repository
          .getDataSetFor(ServiceConfig, 'serviceId')
          .remove(elevated, serviceId)
          .catch(
            (e) =>
              void logger.warning({
                message: 'Failed to remove service config during delete',
                data: { serviceId, error: e },
              }),
          )
        await repository.getDataSetFor(ServiceDefinition, 'id').remove(elevated, serviceId)
        return textResult(`Service ${serviceId} deleted`)
      } catch (error) {
        return errorResult(`Failed to delete service: ${(error as Error).message}`)
      }
    },
  )

  mcp.registerTool(
    'get_service_history',
    {
      description:
        'Get the audit log of state transitions for a service (start, stop, crash, install, build, clone, etc.). Includes who triggered each event and how.',
      inputSchema: {
        serviceId: z.string().describe('UUID of the service to get history for'),
        limit: z.number().optional().default(50).describe('Maximum number of history entries to return (default: 50)'),
      },
      annotations: { readOnlyHint: true },
    },
    async ({ serviceId, limit }) => {
      const entries = await repository.getDataSetFor(ServiceStateHistory, 'id').find(elevated, {
        filter: { serviceId: { $eq: serviceId } },
        order: { id: 'DESC' },
        top: limit,
      })
      return textResult(JSON.stringify(entries, null, 2))
    },
  )
}
