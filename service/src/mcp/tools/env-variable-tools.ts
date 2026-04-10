import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import type { Injector } from '@furystack/inject'
import { getRepository } from '@furystack/repository'
import { ServiceConfig, StackConfig } from 'common'
import { z } from 'zod'

import { CryptoService } from '../../utils/crypto-service.js'
import { encryptEnvValues } from '../../utils/env-encryption-helpers.js'
import { environmentVariableValueSchema, errorResult, textResult } from './mcp-helpers.js'

export const registerEnvVariableTools = (mcp: McpServer, _injector: Injector, elevated: Injector) => {
  const repository = getRepository(elevated)
  const crypto = elevated.getInstance(CryptoService)

  mcp.registerTool(
    'set_stack_env_variable',
    {
      description:
        'Set or update a single stack-level environment variable. Stack env variables are inherited by all services unless overridden per-service.',
      inputSchema: {
        stackName: z.string().describe('Name of the stack'),
        variableName: z.string().describe('Environment variable name (e.g. "DATABASE_URL")'),
        value: environmentVariableValueSchema.describe('How the variable value is resolved'),
      },
      annotations: { idempotentHint: true },
    },
    async ({ stackName, variableName, value }) => {
      try {
        const configs = await repository
          .getDataSetFor(StackConfig, 'stackName')
          .find(elevated, { filter: { stackName: { $eq: stackName } }, top: 1 })
        const config = configs[0]
        if (!config) return errorResult(`Stack config not found: ${stackName}`)

        const updated = encryptEnvValues(
          crypto,
          { ...config.environmentVariables, [variableName]: value },
          config.environmentVariables,
        )
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
      description:
        'Remove a single environment variable from a stack. Services that relied on this variable will no longer receive it unless they have their own override.',
      inputSchema: {
        stackName: z.string().describe('Name of the stack'),
        variableName: z.string().describe('Environment variable name to remove'),
      },
      annotations: { destructiveHint: true },
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
      description:
        'Set or update a per-service environment variable override. Overrides the stack-level default for this variable on this service only.',
      inputSchema: {
        serviceId: z.string().describe('UUID of the service'),
        variableName: z.string().describe('Environment variable name (e.g. "PORT")'),
        value: environmentVariableValueSchema.describe('How the variable value is resolved'),
      },
      annotations: { idempotentHint: true },
    },
    async ({ serviceId, variableName, value }) => {
      try {
        const configs = await repository
          .getDataSetFor(ServiceConfig, 'serviceId')
          .find(elevated, { filter: { serviceId: { $eq: serviceId } }, top: 1 })
        const config = configs[0]
        if (!config) return errorResult(`Service config not found: ${serviceId}`)

        const updated = encryptEnvValues(
          crypto,
          { ...config.environmentVariableOverrides, [variableName]: value },
          config.environmentVariableOverrides,
        )
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
      description:
        'Remove a per-service environment variable override. The service will fall back to the stack-level default for this variable.',
      inputSchema: {
        serviceId: z.string().describe('UUID of the service'),
        variableName: z.string().describe('Environment variable name to remove the override for'),
      },
      annotations: { destructiveHint: true },
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
