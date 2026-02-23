import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import type { Injector } from '@furystack/inject'
import { getRepository } from '@furystack/repository'
import { ServiceConfig, ServiceDefinition, ServiceStateHistory, ServiceStatus } from 'common'
import { randomUUID } from 'crypto'
import { z } from 'zod'

import { LogStorageService } from '../../services/log-storage-service.js'
import { ProcessManager } from '../../services/process-manager.js'
import {
  environmentVariableValueSchema,
  errorResult,
  mcpTrigger,
  registerServiceAction,
  textResult,
} from './mcp-helpers.js'

export const registerServiceTools = (mcp: McpServer, injector: Injector, elevated: Injector) => {
  const repository = getRepository(elevated)

  mcp.registerTool(
    'list_services',
    { description: 'List services in a stack with status', inputSchema: { stackName: z.string() } },
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

  registerServiceAction(mcp, 'start_service', 'Start a service', injector, 'startService', 'started')
  registerServiceAction(mcp, 'stop_service', 'Stop a service', injector, 'stopService', 'stopped')
  registerServiceAction(mcp, 'restart_service', 'Restart a service', injector, 'restartService', 'restarted')
  registerServiceAction(
    mcp,
    'install_service',
    'Install dependencies for a service',
    injector,
    'installService',
    'installed',
  )
  registerServiceAction(mcp, 'build_service', 'Build a service', injector, 'buildService', 'built')
  registerServiceAction(
    mcp,
    'setup_service',
    'Set up a service: clone repository, install dependencies, build. Runs the full setup pipeline.',
    injector,
    'setupService',
    'set up',
  )
  registerServiceAction(
    mcp,
    'update_service',
    'Update a service: pull latest changes, reinstall, rebuild, restart if it was running.',
    injector,
    'updateService',
    'updated',
  )

  mcp.registerTool(
    'get_service_logs',
    {
      description: 'Get recent log output for a service',
      inputSchema: { serviceId: z.string(), lines: z.number().optional().default(100) },
    },
    async ({ serviceId, lines }) => {
      const entries = await injector.getInstance(LogStorageService).getEntries(serviceId, { limit: lines })
      const logLines = entries.reverse().map((e) => e.line)
      return textResult(logLines.join('\n') || '(no logs)')
    },
  )

  mcp.registerTool(
    'pull_service',
    { description: 'Git clone or pull for a service', inputSchema: { serviceId: z.string() } },
    async ({ serviceId }) => {
      try {
        const result = await injector.getInstance(ProcessManager).cloneOrPullService(serviceId, mcpTrigger)
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
      description: 'Create a new service in a stack',
      inputSchema: {
        id: z.string().optional().describe('UUID. Auto-generated if omitted.'),
        stackName: z.string(),
        displayName: z.string(),
        description: z.string().optional(),
        workingDirectory: z.string().optional().describe('Relative path within the stack directory'),
        repositoryId: z.string().optional().describe('FK to a GitHub repository'),
        prerequisiteIds: z.array(z.string()).optional(),
        prerequisiteServiceIds: z.array(z.string()).optional().describe('IDs of services that must run first'),
        installCommand: z.string().optional().describe('e.g. "npm install"'),
        buildCommand: z.string().optional().describe('e.g. "npm run build"'),
        runCommand: z.string().describe('e.g. "npm start"'),
        autoFetchEnabled: z.boolean().optional(),
        autoFetchIntervalMinutes: z.number().optional(),
        autoRestartOnFetch: z.boolean().optional(),
        environmentVariableOverrides: z.record(z.string(), environmentVariableValueSchema).optional(),
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
      autoFetchEnabled,
      autoFetchIntervalMinutes,
      autoRestartOnFetch,
      environmentVariableOverrides,
    }) => {
      try {
        const now = new Date().toISOString()
        const id = providedId ?? randomUUID()

        const def = {
          id,
          stackName,
          displayName,
          description: description ?? '',
          workingDirectory,
          repositoryId,
          prerequisiteIds: prerequisiteIds ?? [],
          prerequisiteServiceIds: prerequisiteServiceIds ?? [],
          installCommand,
          buildCommand,
          runCommand,
          createdAt: now,
          updatedAt: now,
        }

        const config = {
          serviceId: id,
          autoFetchEnabled: autoFetchEnabled ?? false,
          autoFetchIntervalMinutes: autoFetchIntervalMinutes ?? 60,
          autoRestartOnFetch: autoRestartOnFetch ?? false,
          environmentVariableOverrides: environmentVariableOverrides ?? {},
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

        return textResult(JSON.stringify({ ...def, ...config, ...status }, null, 2))
      } catch (error) {
        return errorResult(`Failed to create service: ${(error as Error).message}`)
      }
    },
  )

  mcp.registerTool(
    'edit_service',
    {
      description: 'Edit a service definition and/or configuration fields (PATCH semantics)',
      inputSchema: {
        serviceId: z.string(),
        displayName: z.string().optional(),
        description: z.string().optional(),
        workingDirectory: z.string().optional(),
        repositoryId: z.string().optional(),
        prerequisiteIds: z.array(z.string()).optional(),
        prerequisiteServiceIds: z.array(z.string()).optional(),
        installCommand: z.string().optional(),
        buildCommand: z.string().optional(),
        runCommand: z.string().optional(),
        autoFetchEnabled: z.boolean().optional(),
        autoFetchIntervalMinutes: z.number().optional(),
        autoRestartOnFetch: z.boolean().optional(),
        environmentVariableOverrides: z.record(z.string(), environmentVariableValueSchema).optional(),
      },
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
        if (prerequisiteIds !== undefined) defFields.prerequisiteIds = prerequisiteIds
        if (prerequisiteServiceIds !== undefined) defFields.prerequisiteServiceIds = prerequisiteServiceIds
        if (installCommand !== undefined) defFields.installCommand = installCommand
        if (buildCommand !== undefined) defFields.buildCommand = buildCommand
        if (runCommand !== undefined) defFields.runCommand = runCommand

        const configFields: Partial<ServiceConfig> = {}
        if (autoFetchEnabled !== undefined) configFields.autoFetchEnabled = autoFetchEnabled
        if (autoFetchIntervalMinutes !== undefined) configFields.autoFetchIntervalMinutes = autoFetchIntervalMinutes
        if (autoRestartOnFetch !== undefined) configFields.autoRestartOnFetch = autoRestartOnFetch
        if (environmentVariableOverrides !== undefined)
          configFields.environmentVariableOverrides = environmentVariableOverrides

        if (Object.keys(defFields).length > 0) {
          await repository.getDataSetFor(ServiceDefinition, 'id').update(elevated, serviceId, defFields)
        }
        if (Object.keys(configFields).length > 0) {
          await repository.getDataSetFor(ServiceConfig, 'serviceId').update(elevated, serviceId, configFields)
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
      description: 'Delete a service and its associated config and status',
      inputSchema: { serviceId: z.string() },
    },
    async ({ serviceId }) => {
      try {
        await repository
          .getDataSetFor(ServiceStatus, 'serviceId')
          .remove(elevated, serviceId)
          .catch(() => {})
        await repository
          .getDataSetFor(ServiceConfig, 'serviceId')
          .remove(elevated, serviceId)
          .catch(() => {})
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
      description: 'Get state change history for a service',
      inputSchema: {
        serviceId: z.string(),
        limit: z.number().optional().default(50),
      },
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
