import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import type { Injector } from '@furystack/inject'
import { getRepository } from '@furystack/repository'
import { ServiceDefinition } from 'common'
import type { ServiceFile } from 'common'
import { z } from 'zod'

import { ProcessManager } from '../../services/process-manager.js'
import { errorResult, textResult } from './mcp-helpers.js'

export const registerServiceFileTools = (mcp: McpServer, injector: Injector, elevated: Injector) => {
  const repository = getRepository(elevated)
  const svcDs = () => repository.getDataSetFor(ServiceDefinition, 'id')

  const getService = async (serviceId: string) => {
    const results = await svcDs().find(elevated, { filter: { id: { $eq: serviceId } }, top: 1 })
    return results[0]
  }

  mcp.registerTool(
    'list_service_files',
    {
      description: 'List shared files for a service',
      inputSchema: { serviceId: z.string() },
    },
    async ({ serviceId }) => {
      const svc = await getService(serviceId)
      if (!svc) return errorResult(`Service not found: ${serviceId}`)
      return textResult(JSON.stringify(svc.files ?? [], null, 2))
    },
  )

  mcp.registerTool(
    'read_service_file',
    {
      description: 'Read the content of a specific shared file by relative path',
      inputSchema: {
        serviceId: z.string(),
        relativePath: z.string().describe('Relative path of the file to read'),
      },
    },
    async ({ serviceId, relativePath }) => {
      const svc = await getService(serviceId)
      if (!svc) return errorResult(`Service not found: ${serviceId}`)
      const files: ServiceFile[] = svc.files ?? []
      const file = files.find((f) => f.relativePath === relativePath)
      if (!file) return errorResult(`File not found: ${relativePath}`)
      return textResult(file.content)
    },
  )

  mcp.registerTool(
    'add_service_file',
    {
      description: 'Add a shared file to a service. Errors if a file with the same path already exists.',
      inputSchema: {
        serviceId: z.string(),
        relativePath: z.string().describe('Relative path from the service root (e.g. ".env", "config/app.json")'),
        content: z.string().describe('File content (plain text)'),
      },
    },
    async ({ serviceId, relativePath, content }) => {
      try {
        const svc = await getService(serviceId)
        if (!svc) return errorResult(`Service not found: ${serviceId}`)

        const files: ServiceFile[] = svc.files ?? []
        if (files.some((f) => f.relativePath === relativePath)) {
          return errorResult(`File already exists: ${relativePath}. Use update_service_file to modify it.`)
        }

        files.push({ relativePath, content })
        await svcDs().update(elevated, serviceId, { files })
        return textResult(`File added: ${relativePath}`)
      } catch (error) {
        return errorResult(`Failed to add file: ${(error as Error).message}`)
      }
    },
  )

  mcp.registerTool(
    'update_service_file',
    {
      description: 'Update the content of an existing shared file',
      inputSchema: {
        serviceId: z.string(),
        relativePath: z.string().describe('Relative path of the file to update'),
        content: z.string().describe('New file content'),
      },
    },
    async ({ serviceId, relativePath, content }) => {
      try {
        const svc = await getService(serviceId)
        if (!svc) return errorResult(`Service not found: ${serviceId}`)

        const files: ServiceFile[] = svc.files ?? []
        const idx = files.findIndex((f) => f.relativePath === relativePath)
        if (idx === -1) return errorResult(`File not found: ${relativePath}`)

        files[idx] = { relativePath, content }
        await svcDs().update(elevated, serviceId, { files })
        return textResult(`File updated: ${relativePath}`)
      } catch (error) {
        return errorResult(`Failed to update file: ${(error as Error).message}`)
      }
    },
  )

  mcp.registerTool(
    'remove_service_file',
    {
      description: 'Remove a shared file from a service',
      inputSchema: {
        serviceId: z.string(),
        relativePath: z.string().describe('Relative path of the file to remove'),
      },
    },
    async ({ serviceId, relativePath }) => {
      try {
        const svc = await getService(serviceId)
        if (!svc) return errorResult(`Service not found: ${serviceId}`)

        const files: ServiceFile[] = svc.files ?? []
        const idx = files.findIndex((f) => f.relativePath === relativePath)
        if (idx === -1) return errorResult(`File not found: ${relativePath}`)

        files.splice(idx, 1)
        await svcDs().update(elevated, serviceId, { files })
        return textResult(`File removed: ${relativePath}`)
      } catch (error) {
        return errorResult(`Failed to remove file: ${(error as Error).message}`)
      }
    },
  )

  mcp.registerTool(
    'apply_service_files',
    {
      description: 'Write all shared files to disk in the service working directory',
      inputSchema: { serviceId: z.string() },
    },
    async ({ serviceId }) => {
      try {
        const applied = await injector.getInstance(ProcessManager).applyFiles(serviceId)
        if (applied.length === 0) return textResult('No shared files to apply')
        return textResult(`Applied ${applied.length} file(s): ${applied.join(', ')}`)
      } catch (error) {
        return errorResult(`Failed to apply files: ${(error as Error).message}`)
      }
    },
  )

  mcp.registerTool(
    'apply_service_file',
    {
      description: 'Write a single shared file to disk in the service working directory',
      inputSchema: {
        serviceId: z.string(),
        relativePath: z.string().describe('Relative path of the file to apply'),
      },
    },
    async ({ serviceId, relativePath }) => {
      try {
        const applied = await injector.getInstance(ProcessManager).applyFiles(serviceId, relativePath)
        if (applied.length === 0) return errorResult(`File not found: ${relativePath}`)
        return textResult(`Applied: ${applied.join(', ')}`)
      } catch (error) {
        return errorResult(`Failed to apply file: ${(error as Error).message}`)
      }
    },
  )
}
