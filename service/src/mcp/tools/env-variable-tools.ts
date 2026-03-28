import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import type { Injector } from '@furystack/inject'
import { getRepository } from '@furystack/repository'
import { ServiceConfig, StackConfig } from 'common'
import { z } from 'zod'

import { environmentVariableValueSchema, errorResult, textResult } from './mcp-helpers.js'

export const registerEnvVariableTools = (mcp: McpServer, _injector: Injector, elevated: Injector) => {
  const repository = getRepository(elevated)

  mcp.registerTool(
    'set_stack_env_variable',
    {
      description: 'Set or update a single environment variable on a stack',
      inputSchema: {
        stackName: z.string(),
        variableName: z.string(),
        value: environmentVariableValueSchema,
      },
    },
    async ({ stackName, variableName, value }) => {
      try {
        const configs = await repository
          .getDataSetFor(StackConfig, 'stackName')
          .find(elevated, { filter: { stackName: { $eq: stackName } }, top: 1 })
        const config = configs[0]
        if (!config) return errorResult(`Stack config not found: ${stackName}`)

        const updated = { ...config.environmentVariables, [variableName]: value }
        await repository
          .getDataSetFor(StackConfig, 'stackName')
          .update(elevated, stackName, { environmentVariables: updated })
        return textResult(`Set ${variableName} on stack ${stackName}`)
      } catch (error) {
        return errorResult(`Failed: ${(error as Error).message}`)
      }
    },
  )

  mcp.registerTool(
    'remove_stack_env_variable',
    {
      description: 'Remove a single environment variable from a stack',
      inputSchema: {
        stackName: z.string(),
        variableName: z.string(),
      },
    },
    async ({ stackName, variableName }) => {
      try {
        const configs = await repository
          .getDataSetFor(StackConfig, 'stackName')
          .find(elevated, { filter: { stackName: { $eq: stackName } }, top: 1 })
        const config = configs[0]
        if (!config) return errorResult(`Stack config not found: ${stackName}`)

        const { [variableName]: _, ...remaining } = config.environmentVariables
        await repository
          .getDataSetFor(StackConfig, 'stackName')
          .update(elevated, stackName, { environmentVariables: remaining })
        return textResult(`Removed ${variableName} from stack ${stackName}`)
      } catch (error) {
        return errorResult(`Failed: ${(error as Error).message}`)
      }
    },
  )

  mcp.registerTool(
    'set_service_env_override',
    {
      description: 'Set or update a single environment variable override on a service',
      inputSchema: {
        serviceId: z.string(),
        variableName: z.string(),
        value: environmentVariableValueSchema,
      },
    },
    async ({ serviceId, variableName, value }) => {
      try {
        const configs = await repository
          .getDataSetFor(ServiceConfig, 'serviceId')
          .find(elevated, { filter: { serviceId: { $eq: serviceId } }, top: 1 })
        const config = configs[0]
        if (!config) return errorResult(`Service config not found: ${serviceId}`)

        const updated = { ...config.environmentVariableOverrides, [variableName]: value }
        await repository
          .getDataSetFor(ServiceConfig, 'serviceId')
          .update(elevated, serviceId, { environmentVariableOverrides: updated })
        return textResult(`Set ${variableName} override on service ${serviceId}`)
      } catch (error) {
        return errorResult(`Failed: ${(error as Error).message}`)
      }
    },
  )

  mcp.registerTool(
    'remove_service_env_override',
    {
      description: 'Remove a single environment variable override from a service',
      inputSchema: {
        serviceId: z.string(),
        variableName: z.string(),
      },
    },
    async ({ serviceId, variableName }) => {
      try {
        const configs = await repository
          .getDataSetFor(ServiceConfig, 'serviceId')
          .find(elevated, { filter: { serviceId: { $eq: serviceId } }, top: 1 })
        const config = configs[0]
        if (!config) return errorResult(`Service config not found: ${serviceId}`)

        const { [variableName]: _, ...remaining } = config.environmentVariableOverrides
        await repository
          .getDataSetFor(ServiceConfig, 'serviceId')
          .update(elevated, serviceId, { environmentVariableOverrides: remaining })
        return textResult(`Removed ${variableName} override from service ${serviceId}`)
      } catch (error) {
        return errorResult(`Failed: ${(error as Error).message}`)
      }
    },
  )
}
