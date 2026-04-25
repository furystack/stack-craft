import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import type { Injector } from '@furystack/inject'
import { ServiceConfig, ServiceDefinition } from 'common'
import type { ServiceFile } from 'common'
import { z } from 'zod'

import { ProcessManager } from '../../services/process-manager.js'
import { CryptoService } from '../../utils/crypto-service.js'
import { decryptLocalFiles, encryptLocalFiles } from '../../utils/env-encryption-helpers.js'
import { errorResult, textResult } from './mcp-helpers.js'
import { legacyRepository as getRepository } from '../../utils/legacy-repository.js'

export const registerServiceFileTools = (mcp: McpServer, injector: Injector, elevated: Injector) => {
  const repository = getRepository(elevated)
  const crypto = elevated.get(CryptoService)
  const svcDs = () => repository.getDataSetFor(ServiceDefinition, 'id')
  const svcConfigDs = () => repository.getDataSetFor(ServiceConfig, 'serviceId')

  const getService = async (serviceId: string) => {
    const results = await svcDs().find(elevated, { filter: { id: { $eq: serviceId } }, top: 1 })
    return results[0]
  }

  mcp.registerTool(
    'list_service_files',
    {
      description:
        'List shared files for a service. Shared files are included in exports and placed relative to the service working directory.',
      inputSchema: { serviceId: z.string().describe('UUID of the service') },
      annotations: { readOnlyHint: true },
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
      description: 'Read the content of a specific shared file by its relative path.',
      inputSchema: {
        serviceId: z.string().describe('UUID of the service'),
        relativePath: z.string().describe('Relative path of the file to read (e.g. ".env", "config/app.json")'),
      },
      annotations: { readOnlyHint: true },
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
      description:
        'Add a shared file to a service. Shared files are included in exports. Errors if a file with the same path already exists (use update_service_file to modify). Use add_local_file for secrets that should not be exported.',
      inputSchema: {
        serviceId: z.string().describe('UUID of the service'),
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
      description: 'Update the content of an existing shared file. Errors if the file does not exist.',
      inputSchema: {
        serviceId: z.string().describe('UUID of the service'),
        relativePath: z.string().describe('Relative path of the file to update'),
        content: z.string().describe('New file content (replaces existing content entirely)'),
      },
      annotations: { idempotentHint: true },
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
      description: 'Remove a shared file from a service. Does not delete the file from disk if already applied.',
      inputSchema: {
        serviceId: z.string().describe('UUID of the service'),
        relativePath: z.string().describe('Relative path of the file to remove'),
      },
      annotations: { destructiveHint: true },
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
      description:
        'Write all shared and local files to disk in the service working directory. Local files take precedence over shared files when they share the same relativePath.',
      inputSchema: { serviceId: z.string().describe('UUID of the service') },
    },
    async ({ serviceId }) => {
      try {
        const applied = await injector.get(ProcessManager).applyFiles(serviceId)
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
      description:
        'Write a single file to disk in the service working directory. If a local file exists at the same path, it takes precedence over the shared file.',
      inputSchema: {
        serviceId: z.string().describe('UUID of the service'),
        relativePath: z.string().describe('Relative path of the file to write to disk'),
      },
    },
    async ({ serviceId, relativePath }) => {
      try {
        const applied = await injector.get(ProcessManager).applyFiles(serviceId, relativePath)
        if (applied.length === 0) return errorResult(`File not found: ${relativePath}`)
        return textResult(`Applied: ${applied.join(', ')}`)
      } catch (error) {
        return errorResult(`Failed to apply file: ${(error as Error).message}`)
      }
    },
  )

  const getServiceConfig = async (serviceId: string) => {
    const results = await svcConfigDs().find(elevated, { filter: { serviceId: { $eq: serviceId } }, top: 1 })
    return results[0]
  }

  mcp.registerTool(
    'list_local_files',
    {
      description:
        'List local (secret) files for a service. Local files are encrypted at rest, never included in exports, and override shared files with the same path at apply time. Returns paths and content lengths (not content).',
      inputSchema: { serviceId: z.string().describe('UUID of the service') },
      annotations: { readOnlyHint: true },
    },
    async ({ serviceId }) => {
      const config = await getServiceConfig(serviceId)
      if (!config) return errorResult(`Service config not found: ${serviceId}`)
      const files = decryptLocalFiles(crypto, config.localFiles ?? [])
      return textResult(
        JSON.stringify(
          files.map((f) => ({ relativePath: f.relativePath, contentLength: f.content.length })),
          null,
          2,
        ),
      )
    },
  )

  mcp.registerTool(
    'read_local_file',
    {
      description:
        'Read the content of a specific local (secret) file. Content is returned decrypted. Local files are encrypted at rest and never exported.',
      inputSchema: {
        serviceId: z.string().describe('UUID of the service'),
        relativePath: z.string().describe('Relative path of the local file to read (e.g. ".env.local")'),
      },
      annotations: { readOnlyHint: true },
    },
    async ({ serviceId, relativePath }) => {
      const config = await getServiceConfig(serviceId)
      if (!config) return errorResult(`Service config not found: ${serviceId}`)
      const files = decryptLocalFiles(crypto, config.localFiles ?? [])
      const file = files.find((f) => f.relativePath === relativePath)
      if (!file) return errorResult(`Local file not found: ${relativePath}`)
      return textResult(file.content)
    },
  )

  mcp.registerTool(
    'add_local_file',
    {
      description:
        'Add a local (secret) file to a service. Encrypted at rest and never included in exports. Overrides shared files with the same path at apply time. Use for secrets like .env.local files.',
      inputSchema: {
        serviceId: z.string().describe('UUID of the service'),
        relativePath: z.string().describe('Relative path (e.g. ".env.local", "secrets/config.json")'),
        content: z.string().describe('File content (will be encrypted at rest)'),
      },
    },
    async ({ serviceId, relativePath, content }) => {
      try {
        const config = await getServiceConfig(serviceId)
        if (!config) return errorResult(`Service config not found: ${serviceId}`)

        const existing = decryptLocalFiles(crypto, config.localFiles ?? [])
        if (existing.some((f) => f.relativePath === relativePath)) {
          return errorResult(`Local file already exists: ${relativePath}. Use update_local_file to modify it.`)
        }

        existing.push({ relativePath, content })
        await svcConfigDs().update(elevated, serviceId, { localFiles: encryptLocalFiles(crypto, existing) })
        return textResult(`Local file added: ${relativePath}`)
      } catch (error) {
        return errorResult(`Failed to add local file: ${(error as Error).message}`)
      }
    },
  )

  mcp.registerTool(
    'update_local_file',
    {
      description: 'Update the content of an existing local (secret) file. Errors if the file does not exist.',
      inputSchema: {
        serviceId: z.string().describe('UUID of the service'),
        relativePath: z.string().describe('Relative path of the local file to update'),
        content: z.string().describe('New file content (replaces existing content, will be encrypted at rest)'),
      },
      annotations: { idempotentHint: true },
    },
    async ({ serviceId, relativePath, content }) => {
      try {
        const config = await getServiceConfig(serviceId)
        if (!config) return errorResult(`Service config not found: ${serviceId}`)

        const existing = decryptLocalFiles(crypto, config.localFiles ?? [])
        const idx = existing.findIndex((f) => f.relativePath === relativePath)
        if (idx === -1) return errorResult(`Local file not found: ${relativePath}`)

        existing[idx] = { relativePath, content }
        await svcConfigDs().update(elevated, serviceId, { localFiles: encryptLocalFiles(crypto, existing) })
        return textResult(`Local file updated: ${relativePath}`)
      } catch (error) {
        return errorResult(`Failed to update local file: ${(error as Error).message}`)
      }
    },
  )

  mcp.registerTool(
    'remove_local_file',
    {
      description:
        'Remove a local (secret) file from a service. Does not delete the file from disk if already applied.',
      inputSchema: {
        serviceId: z.string().describe('UUID of the service'),
        relativePath: z.string().describe('Relative path of the local file to remove'),
      },
      annotations: { destructiveHint: true },
    },
    async ({ serviceId, relativePath }) => {
      try {
        const config = await getServiceConfig(serviceId)
        if (!config) return errorResult(`Service config not found: ${serviceId}`)

        const existing: ServiceFile[] = config.localFiles ?? []
        const decrypted = decryptLocalFiles(crypto, existing)
        const idx = decrypted.findIndex((f) => f.relativePath === relativePath)
        if (idx === -1) return errorResult(`Local file not found: ${relativePath}`)

        decrypted.splice(idx, 1)
        await svcConfigDs().update(elevated, serviceId, { localFiles: encryptLocalFiles(crypto, decrypted) })
        return textResult(`Local file removed: ${relativePath}`)
      } catch (error) {
        return errorResult(`Failed to remove local file: ${(error as Error).message}`)
      }
    },
  )
}
