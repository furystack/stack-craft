import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js'
import type { Injector } from '@furystack/inject'
import { getLogger } from '@furystack/logging'
import { getRepository } from '@furystack/repository'
import { Dependency, GitHubRepository, Service, Stack } from 'common'
import { randomUUID } from 'crypto'
import type { IncomingMessage, ServerResponse } from 'http'
import { z } from 'zod'

import { resolveServiceCwd } from '../utils/resolve-service-cwd.js'
import { resolveTokenUser } from '../middleware/bearer-token-auth.js'
import { ProcessManager } from '../services/process-manager.js'
import { GitService } from '../services/git-service.js'

type TextResult = { content: [{ type: 'text'; text: string }]; isError?: true }

const textResult = (text: string): TextResult => ({ content: [{ type: 'text', text }] })
const errorResult = (text: string): TextResult => ({ content: [{ type: 'text', text }], isError: true })

const registerServiceAction = (
  mcp: McpServer,
  name: string,
  description: string,
  injector: Injector,
  method: keyof Pick<
    ProcessManager,
    'startService' | 'stopService' | 'restartService' | 'installService' | 'buildService'
  >,
  pastTense: string,
) => {
  mcp.registerTool(name, { description, inputSchema: { serviceId: z.string() } }, async ({ serviceId }) => {
    try {
      await injector.getInstance(ProcessManager)[method](serviceId)
      return textResult(`Service ${serviceId} ${pastTense}`)
    } catch (error) {
      return errorResult(`Failed: ${(error as Error).message}`)
    }
  })
}

export const createMcpServer = (injector: Injector, elevated: Injector) => {
  const mcp = new McpServer({ name: 'stackcraft', version: '1.0.0' }, { capabilities: { tools: {} } })
  const repository = getRepository(elevated)

  mcp.registerTool('list_stacks', { description: 'List all stacks' }, async () => {
    const stacks = await repository.getDataSetFor(Stack, 'name').find(elevated, {})
    return textResult(JSON.stringify(stacks, null, 2))
  })

  mcp.registerTool(
    'get_stack',
    {
      description: 'Get a full stack definition with services, repositories, and dependencies',
      inputSchema: { stackName: z.string() },
    },
    async ({ stackName }) => {
      const stacks = await repository
        .getDataSetFor(Stack, 'name')
        .find(elevated, { filter: { name: { $eq: stackName } }, top: 1 })
      const stack = stacks[0]
      if (!stack) return errorResult(`Stack not found: ${stackName}`)

      const services = await repository
        .getDataSetFor(Service, 'id')
        .find(elevated, { filter: { stackName: { $eq: stackName } } })
      const repos = await repository
        .getDataSetFor(GitHubRepository, 'id')
        .find(elevated, { filter: { stackName: { $eq: stackName } } })
      const deps = await repository
        .getDataSetFor(Dependency, 'id')
        .find(elevated, { filter: { stackName: { $eq: stackName } } })

      return textResult(JSON.stringify({ stack, services, repositories: repos, dependencies: deps }, null, 2))
    },
  )

  mcp.registerTool(
    'list_services',
    { description: 'List services in a stack with status', inputSchema: { stackName: z.string() } },
    async ({ stackName }) => {
      const services = await repository
        .getDataSetFor(Service, 'id')
        .find(elevated, { filter: { stackName: { $eq: stackName } } })
      const summary = services.map((s) => ({
        id: s.id,
        displayName: s.displayName,
        runStatus: s.runStatus,
        installStatus: s.installStatus,
        buildStatus: s.buildStatus,
      }))
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

  mcp.registerTool(
    'get_service_logs',
    {
      description: 'Get recent log output for a service',
      inputSchema: { serviceId: z.string(), lines: z.number().optional().default(100) },
    },
    async ({ serviceId, lines }) => {
      const logLines = injector.getInstance(ProcessManager).getLogLines(serviceId, lines)
      return textResult(logLines.join('\n') || '(no logs)')
    },
  )

  mcp.registerTool(
    'pull_service',
    { description: 'Git pull for a service', inputSchema: { serviceId: z.string() } },
    async ({ serviceId }) => {
      const services = await repository
        .getDataSetFor(Service, 'id')
        .find(elevated, { filter: { id: { $eq: serviceId } }, top: 1 })
      const svc = services[0]
      if (!svc) return errorResult('Service not found')

      try {
        const cwd = await resolveServiceCwd(injector, svc)
        const result = await injector.getInstance(GitService).pull(cwd)
        return textResult(result.updated ? 'Changes pulled' : 'Already up to date')
      } catch (error) {
        return errorResult(`Failed: ${(error as Error).message}`)
      }
    },
  )

  mcp.registerTool(
    'check_dependency',
    { description: 'Run a dependency check command', inputSchema: { dependencyId: z.string() } },
    async ({ dependencyId }) => {
      const deps = await repository
        .getDataSetFor(Dependency, 'id')
        .find(elevated, { filter: { id: { $eq: dependencyId } }, top: 1 })
      const dep = deps[0]
      if (!dep) return errorResult('Dependency not found')

      const { execFile } = await import('child_process')
      const { promisify } = await import('util')
      const execFileAsync = promisify(execFile)

      try {
        const { stdout } = await execFileAsync('/bin/sh', ['-c', dep.checkCommand], { timeout: 30000 })
        return textResult(`${dep.name}: satisfied\n${stdout.trim()}`)
      } catch {
        return errorResult(`${dep.name}: NOT satisfied\n${dep.installationHelp}`)
      }
    },
  )

  return mcp
}

const SESSION_TTL_MS = 30 * 60 * 1000

type TransportEntry = {
  transport: StreamableHTTPServerTransport
  lastActivityAt: number
}

export class McpSessionManager {
  private transports = new Map<string, TransportEntry>()
  private sweepInterval: ReturnType<typeof setInterval>

  constructor() {
    this.sweepInterval = setInterval(() => this.sweep(), 60_000)
    this.sweepInterval.unref()
  }

  private sweep() {
    const now = Date.now()
    for (const [id, entry] of this.transports) {
      if (now - entry.lastActivityAt > SESSION_TTL_MS) {
        void entry.transport.close?.()
        this.transports.delete(id)
      }
    }
  }

  public register(sessionId: string, transport: StreamableHTTPServerTransport) {
    this.transports.set(sessionId, { transport, lastActivityAt: Date.now() })
    transport.onclose = () => this.transports.delete(sessionId)
  }

  public get(sessionId: string): TransportEntry | undefined {
    return this.transports.get(sessionId)
  }

  public dispose() {
    clearInterval(this.sweepInterval)
    for (const [, entry] of this.transports) {
      void entry.transport.close?.()
    }
    this.transports.clear()
  }
}

export const createMcpRequestHandler = (injector: Injector, sessionManager: McpSessionManager, elevated: Injector) => {
  const logger = getLogger(injector).withScope('McpRequestHandler')

  return async (req: IncomingMessage, res: ServerResponse) => {
    try {
      const authHeader = req.headers.authorization
      const user = await resolveTokenUser(injector, authHeader)
      if (!user) {
        res.writeHead(401, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ error: 'Unauthorized. Provide a valid Bearer token.' }))
        return
      }

      const sessionId = req.headers['mcp-session-id'] as string | undefined

      if (req.method === 'POST' && !sessionId) {
        const transport = new StreamableHTTPServerTransport({
          sessionIdGenerator: () => randomUUID(),
        })

        const mcp = createMcpServer(injector, elevated)
        await mcp.connect(transport)

        if (transport.sessionId) {
          sessionManager.register(transport.sessionId, transport)
        }

        await transport.handleRequest(req, res)
        return
      }

      if (sessionId) {
        const entry = sessionManager.get(sessionId)
        if (entry) {
          entry.lastActivityAt = Date.now()
          await entry.transport.handleRequest(req, res)
          return
        }
      }

      res.writeHead(400, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ error: 'Invalid or missing session' }))
    } catch (error) {
      await logger.error({ message: 'MCP request failed', data: { error } })
      if (!res.headersSent) {
        res.writeHead(500, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ error: 'Internal server error' }))
      }
    }
  }
}
