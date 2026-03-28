import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import type { Injector } from '@furystack/inject'
import { getRepository } from '@furystack/repository'
import { GitHubRepository } from 'common'
import { execFile } from 'child_process'
import { randomUUID } from 'crypto'
import { promisify } from 'util'
import { z } from 'zod'

import { errorResult, textResult } from './mcp-helpers.js'

const execFileAsync = promisify(execFile)

export const registerRepositoryTools = (mcp: McpServer, _injector: Injector, elevated: Injector) => {
  const repository = getRepository(elevated)

  mcp.registerTool(
    'list_repositories',
    {
      description: 'List GitHub repositories, optionally filtered by stack name',
      inputSchema: {
        stackName: z.string().optional().describe('Filter by stack name'),
      },
    },
    async ({ stackName }) => {
      const filter = stackName ? { stackName: { $eq: stackName } } : undefined
      const repos = await repository.getDataSetFor(GitHubRepository, 'id').find(elevated, { filter })
      return textResult(JSON.stringify(repos, null, 2))
    },
  )

  mcp.registerTool(
    'get_repository',
    {
      description: 'Get a single GitHub repository by ID',
      inputSchema: { repositoryId: z.string() },
    },
    async ({ repositoryId }) => {
      const results = await repository
        .getDataSetFor(GitHubRepository, 'id')
        .find(elevated, { filter: { id: { $eq: repositoryId } }, top: 1 })
      const repo = results[0]
      if (!repo) return errorResult(`Repository not found: ${repositoryId}`)
      return textResult(JSON.stringify(repo, null, 2))
    },
  )

  mcp.registerTool(
    'create_repository',
    {
      description: 'Create a new GitHub repository entry for a stack',
      inputSchema: {
        id: z.string().optional().describe('UUID. Auto-generated if omitted.'),
        stackName: z.string(),
        url: z.string().describe('Full URL to the git repository'),
        displayName: z.string(),
        description: z.string().optional(),
      },
    },
    async ({ id: providedId, stackName, url, displayName, description }) => {
      try {
        const now = new Date().toISOString()
        const id = providedId ?? randomUUID()
        const entry = {
          id,
          stackName,
          url,
          displayName,
          description: description ?? '',
          createdAt: now,
          updatedAt: now,
        }
        await repository.getDataSetFor(GitHubRepository, 'id').add(elevated, entry)
        return textResult(JSON.stringify(entry, null, 2))
      } catch (error) {
        return errorResult(`Failed to create repository: ${(error as Error).message}`)
      }
    },
  )

  mcp.registerTool(
    'update_repository',
    {
      description: 'Update a GitHub repository entry (PATCH semantics)',
      inputSchema: {
        repositoryId: z.string(),
        url: z.string().optional(),
        displayName: z.string().optional(),
        description: z.string().optional(),
      },
    },
    async ({ repositoryId, url, displayName, description }) => {
      try {
        const fields: Partial<GitHubRepository> = {}
        if (url !== undefined) fields.url = url
        if (displayName !== undefined) fields.displayName = displayName
        if (description !== undefined) fields.description = description

        if (Object.keys(fields).length > 0) {
          await repository.getDataSetFor(GitHubRepository, 'id').update(elevated, repositoryId, fields)
        }
        return textResult(`Repository ${repositoryId} updated`)
      } catch (error) {
        return errorResult(`Failed to update repository: ${(error as Error).message}`)
      }
    },
  )

  mcp.registerTool(
    'delete_repository',
    {
      description: 'Delete a GitHub repository entry',
      inputSchema: { repositoryId: z.string() },
    },
    async ({ repositoryId }) => {
      try {
        await repository.getDataSetFor(GitHubRepository, 'id').remove(elevated, repositoryId)
        return textResult(`Repository ${repositoryId} deleted`)
      } catch (error) {
        return errorResult(`Failed to delete repository: ${(error as Error).message}`)
      }
    },
  )

  mcp.registerTool(
    'validate_repository',
    {
      description: 'Check if a GitHub repository is accessible via git ls-remote',
      inputSchema: { repositoryId: z.string() },
    },
    async ({ repositoryId }) => {
      const results = await repository
        .getDataSetFor(GitHubRepository, 'id')
        .find(elevated, { filter: { id: { $eq: repositoryId } }, top: 1 })
      const repo = results[0]
      if (!repo) return errorResult(`Repository not found: ${repositoryId}`)

      try {
        await execFileAsync('git', ['ls-remote', '--exit-code', repo.url], { timeout: 15000 })
        return textResult(`Repository ${repo.displayName} (${repo.url}) is accessible`)
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error'
        return errorResult(`Repository ${repo.displayName} (${repo.url}) is not accessible: ${message}`)
      }
    },
  )
}
