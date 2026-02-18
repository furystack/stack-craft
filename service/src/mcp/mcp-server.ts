import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js'
import { getStoreManager } from '@furystack/core'
import type { Injector } from '@furystack/inject'
import { Dependency, GitHubRepository, Service, Stack } from 'common'
import { randomUUID } from 'crypto'
import type { IncomingMessage, ServerResponse } from 'http'
import { ProcessManager } from '../services/process-manager.js'
import { GitService } from '../services/git-service.js'
import { resolveServiceCwd } from '../utils/resolve-service-cwd.js'
import { resolveTokenUser } from '../middleware/bearer-token-auth.js'
import { z } from 'zod'

export const createMcpServer = (injector: Injector) => {
  const mcp = new McpServer({ name: 'stackcraft', version: '1.0.0' }, { capabilities: { tools: {} } })

  mcp.tool('list_stacks', 'List all stacks', {}, async () => {
    const sm = getStoreManager(injector)
    const stacks = await sm.getStoreFor(Stack, 'name').find({})
    return { content: [{ type: 'text', text: JSON.stringify(stacks, null, 2) }] }
  })

  mcp.tool('get_stack', 'Get stack details with all services', { stackName: z.string() }, async ({ stackName }) => {
    const sm = getStoreManager(injector)
    const stacks = await sm.getStoreFor(Stack, 'name').find({ filter: { name: { $eq: stackName } }, top: 1 })
    const stack = stacks[0]
    if (!stack) return { content: [{ type: 'text', text: `Stack not found: ${stackName}` }], isError: true }

    const services = await sm.getStoreFor(Service, 'id').find({ filter: { stackName: { $eq: stackName } } })
    const repos = await sm.getStoreFor(GitHubRepository, 'id').find({ filter: { stackName: { $eq: stackName } } })
    const deps = await sm.getStoreFor(Dependency, 'id').find({ filter: { stackName: { $eq: stackName } } })

    return {
      content: [
        { type: 'text', text: JSON.stringify({ stack, services, repositories: repos, dependencies: deps }, null, 2) },
      ],
    }
  })

  mcp.tool(
    'list_services',
    'List services in a stack with status',
    { stackName: z.string() },
    async ({ stackName }) => {
      const sm = getStoreManager(injector)
      const services = await sm.getStoreFor(Service, 'id').find({ filter: { stackName: { $eq: stackName } } })
      const summary = services.map((s) => ({
        id: s.id,
        displayName: s.displayName,
        runStatus: s.runStatus,
        installStatus: s.installStatus,
        buildStatus: s.buildStatus,
      }))
      return { content: [{ type: 'text', text: JSON.stringify(summary, null, 2) }] }
    },
  )

  mcp.tool('start_service', 'Start a service', { serviceId: z.string() }, async ({ serviceId }) => {
    try {
      await injector.getInstance(ProcessManager).startService(serviceId)
      return { content: [{ type: 'text', text: `Service ${serviceId} started` }] }
    } catch (error) {
      return { content: [{ type: 'text', text: `Failed: ${(error as Error).message}` }], isError: true }
    }
  })

  mcp.tool('stop_service', 'Stop a service', { serviceId: z.string() }, async ({ serviceId }) => {
    try {
      await injector.getInstance(ProcessManager).stopService(serviceId)
      return { content: [{ type: 'text', text: `Service ${serviceId} stopped` }] }
    } catch (error) {
      return { content: [{ type: 'text', text: `Failed: ${(error as Error).message}` }], isError: true }
    }
  })

  mcp.tool('restart_service', 'Restart a service', { serviceId: z.string() }, async ({ serviceId }) => {
    try {
      await injector.getInstance(ProcessManager).restartService(serviceId)
      return { content: [{ type: 'text', text: `Service ${serviceId} restarted` }] }
    } catch (error) {
      return { content: [{ type: 'text', text: `Failed: ${(error as Error).message}` }], isError: true }
    }
  })

  mcp.tool(
    'install_service',
    'Install dependencies for a service',
    { serviceId: z.string() },
    async ({ serviceId }) => {
      try {
        await injector.getInstance(ProcessManager).installService(serviceId)
        return { content: [{ type: 'text', text: `Service ${serviceId} installed` }] }
      } catch (error) {
        return { content: [{ type: 'text', text: `Failed: ${(error as Error).message}` }], isError: true }
      }
    },
  )

  mcp.tool('build_service', 'Build a service', { serviceId: z.string() }, async ({ serviceId }) => {
    try {
      await injector.getInstance(ProcessManager).buildService(serviceId)
      return { content: [{ type: 'text', text: `Service ${serviceId} built` }] }
    } catch (error) {
      return { content: [{ type: 'text', text: `Failed: ${(error as Error).message}` }], isError: true }
    }
  })

  mcp.tool(
    'get_service_logs',
    'Get recent log output for a service',
    { serviceId: z.string(), lines: z.number().optional().default(100) },
    async ({ serviceId, lines }) => {
      const logLines = injector.getInstance(ProcessManager).getLogLines(serviceId, lines)
      return { content: [{ type: 'text', text: logLines.join('\n') || '(no logs)' }] }
    },
  )

  mcp.tool('pull_service', 'Git pull for a service', { serviceId: z.string() }, async ({ serviceId }) => {
    const sm = getStoreManager(injector)
    const services = await sm.getStoreFor(Service, 'id').find({ filter: { id: { $eq: serviceId } }, top: 1 })
    const svc = services[0]
    if (!svc) {
      return { content: [{ type: 'text', text: 'Service not found' }], isError: true }
    }
    try {
      const cwd = await resolveServiceCwd(injector, svc)
      const result = await injector.getInstance(GitService).pull(cwd)
      return { content: [{ type: 'text', text: result.updated ? 'Changes pulled' : 'Already up to date' }] }
    } catch (error) {
      return { content: [{ type: 'text', text: `Failed: ${(error as Error).message}` }], isError: true }
    }
  })

  mcp.tool(
    'check_dependency',
    'Run a dependency check command',
    { dependencyId: z.string() },
    async ({ dependencyId }) => {
      const sm = getStoreManager(injector)
      const deps = await sm.getStoreFor(Dependency, 'id').find({ filter: { id: { $eq: dependencyId } }, top: 1 })
      const dep = deps[0]
      if (!dep) return { content: [{ type: 'text', text: 'Dependency not found' }], isError: true }

      const { execFile } = await import('child_process')
      const { promisify } = await import('util')
      const execFileAsync = promisify(execFile)

      try {
        const { stdout } = await execFileAsync('/bin/sh', ['-c', dep.checkCommand], { timeout: 30000 })
        return { content: [{ type: 'text', text: `${dep.name}: satisfied\n${stdout.trim()}` }] }
      } catch {
        return {
          content: [{ type: 'text', text: `${dep.name}: NOT satisfied\n${dep.installationHelp}` }],
          isError: true,
        }
      }
    },
  )

  mcp.tool('export_stack', 'Export a stack definition as JSON', { stackName: z.string() }, async ({ stackName }) => {
    const sm = getStoreManager(injector)
    const stacks = await sm.getStoreFor(Stack, 'name').find({ filter: { name: { $eq: stackName } }, top: 1 })
    const stack = stacks[0]
    if (!stack) return { content: [{ type: 'text', text: `Stack not found: ${stackName}` }], isError: true }

    const services = await sm.getStoreFor(Service, 'id').find({ filter: { stackName: { $eq: stackName } } })
    const repos = await sm.getStoreFor(GitHubRepository, 'id').find({ filter: { stackName: { $eq: stackName } } })
    const deps = await sm.getStoreFor(Dependency, 'id').find({ filter: { stackName: { $eq: stackName } } })

    return {
      content: [
        { type: 'text', text: JSON.stringify({ stack, services, repositories: repos, dependencies: deps }, null, 2) },
      ],
    }
  })

  return mcp
}

const SESSION_TTL_MS = 30 * 60 * 1000

type TransportEntry = {
  transport: StreamableHTTPServerTransport
  lastActivityAt: number
}

const transports = new Map<string, TransportEntry>()

const sweepInterval = setInterval(() => {
  const now = Date.now()
  for (const [id, entry] of transports) {
    if (now - entry.lastActivityAt > SESSION_TTL_MS) {
      void entry.transport.close?.()
      transports.delete(id)
    }
  }
}, 60_000)
sweepInterval.unref()

export const handleMcpRequest = async (injector: Injector, req: IncomingMessage, res: ServerResponse) => {
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

    const mcp = createMcpServer(injector)
    await mcp.connect(transport)

    if (transport.sessionId) {
      transports.set(transport.sessionId, { transport, lastActivityAt: Date.now() })
    }

    transport.onclose = () => {
      if (transport.sessionId) {
        transports.delete(transport.sessionId)
      }
    }

    await transport.handleRequest(req, res)
    return
  }

  if (sessionId) {
    const entry = transports.get(sessionId)
    if (entry) {
      entry.lastActivityAt = Date.now()
      await entry.transport.handleRequest(req, res)
      return
    }
  }

  res.writeHead(400, { 'Content-Type': 'application/json' })
  res.end(JSON.stringify({ error: 'Invalid or missing session' }))
}
