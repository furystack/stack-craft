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
      description:
        'List GitHub repository entries. Each repository links a git URL to a stack and can be referenced by services via repositoryId.',
      inputSchema: {
        stackName: z.string().optional().describe('Filter by stack name. Returns all repositories if omitted.'),
      },
      annotations: { readOnlyHint: true },
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
      description: 'Get a single GitHub repository entry by ID.',
      inputSchema: { repositoryId: z.string().describe('UUID of the repository to retrieve') },
      annotations: { readOnlyHint: true },
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
      description:
        'Create a new GitHub repository entry for a stack. Services reference repositories via repositoryId to know which repo to clone.',
      inputSchema: {
        id: z.string().optional().describe('UUID primary key. Auto-generated if omitted.'),
        stackName: z.string().describe('Name of the stack this repository belongs to'),
        url: z.string().describe('Full git URL (e.g. "https://github.com/user/repo")'),
        displayName: z.string().describe('Human-readable name shown in the UI'),
        description: z.string().optional().describe('What this repository contains'),
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
      description: 'Update a GitHub repository entry. Uses PATCH semantics: only provided fields are updated.',
      inputSchema: {
        repositoryId: z.string().describe('UUID of the repository to update'),
        url: z.string().optional().describe('Full git URL (e.g. "https://github.com/user/repo")'),
        displayName: z.string().optional().describe('Human-readable name shown in the UI'),
        description: z.string().optional().describe('What this repository contains'),
      },
      annotations: { idempotentHint: true },
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
      description:
        'Delete a GitHub repository entry. Does not remove cloned files from disk or affect services that reference it.',
      inputSchema: { repositoryId: z.string().describe('UUID of the repository to delete') },
      annotations: { destructiveHint: true },
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
      description:
        'Check if a GitHub repository is accessible by running git ls-remote against its URL. Useful for verifying credentials and network access before cloning.',
      inputSchema: { repositoryId: z.string().describe('UUID of the repository to validate') },
      annotations: { readOnlyHint: true, openWorldHint: true },
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
