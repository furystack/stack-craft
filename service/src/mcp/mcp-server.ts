import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js'
import type { Injector } from '@furystack/inject'
import { getLogger } from '@furystack/logging'
import { randomUUID } from 'crypto'
import type { IncomingMessage, ServerResponse } from 'http'

import { resolveTokenUser } from '../middleware/bearer-token-auth.js'
import { registerEnvVariableTools } from './tools/env-variable-tools.js'
import { registerPrerequisiteTools } from './tools/prerequisite-tools.js'
import { registerRepositoryTools } from './tools/repository-tools.js'
import { registerServiceFileTools } from './tools/service-file-tools.js'
import { registerServiceTools } from './tools/service-tools.js'
import { registerStackTools } from './tools/stack-tools.js'
import { registerSystemTools } from './tools/system-tools.js'
import { useUserIdentityContext } from './user-identity-context.js'

export const createMcpServer = (injector: Injector, elevated: Injector) => {
  const mcp = new McpServer({ name: 'stackcraft', version: '1.0.0' }, { capabilities: { tools: {} } })

  registerStackTools(mcp, injector, elevated)
  registerServiceTools(mcp, injector, elevated)
  registerPrerequisiteTools(mcp, injector, elevated)
  registerRepositoryTools(mcp, injector, elevated)
  registerEnvVariableTools(mcp, injector, elevated)
  registerServiceFileTools(mcp, injector, elevated)
  registerSystemTools(mcp, injector, elevated)

  return mcp
}

const SESSION_TTL_MS = parseInt(process.env.MCP_SESSION_TTL_MS as string, 10) || 30 * 60 * 1000
const MAX_SESSIONS = parseInt(process.env.MCP_MAX_SESSIONS as string, 10) || 50

type TransportEntry = {
  transport: StreamableHTTPServerTransport
  userInjector: Injector
  lastActivityAt: number
}

export class McpSessionManager {
  private transports = new Map<string, TransportEntry>()
  private sweepInterval: ReturnType<typeof setInterval>

  constructor() {
    this.sweepInterval = setInterval(
      () => this.sweep(),
      parseInt(process.env.MCP_SESSION_SWEEP_MS as string, 10) || 60_000,
    )
    this.sweepInterval.unref()
  }

  private sweep() {
    const now = Date.now()
    for (const [id, entry] of this.transports) {
      if (now - entry.lastActivityAt > SESSION_TTL_MS) {
        void entry.transport.close?.()
        void entry.userInjector[Symbol.asyncDispose]()
        this.transports.delete(id)
      }
    }
  }

  public get size(): number {
    return this.transports.size
  }

  public register(sessionId: string, transport: StreamableHTTPServerTransport, userInjector: Injector) {
    this.transports.set(sessionId, { transport, userInjector, lastActivityAt: Date.now() })
    transport.onclose = () => {
      void this.transports.get(sessionId)?.userInjector[Symbol.asyncDispose]()
      this.transports.delete(sessionId)
    }
  }

  public get(sessionId: string): TransportEntry | undefined {
    return this.transports.get(sessionId)
  }

  public [Symbol.dispose]() {
    clearInterval(this.sweepInterval)
    for (const [, entry] of this.transports) {
      void entry.transport.close?.()
      void entry.userInjector[Symbol.asyncDispose]()
    }
    this.transports.clear()
  }
}

/**
 * Creates an HTTP request handler for MCP sessions.
 * The `authInjector` is a system-level injector used only for Bearer token resolution.
 * Each new session gets its own user-scoped injector derived from the authenticated user.
 */
export const createMcpRequestHandler = (
  injector: Injector,
  sessionManager: McpSessionManager,
  authInjector: Injector,
) => {
  const logger = getLogger(injector).withScope('McpRequestHandler')

  return async (req: IncomingMessage, res: ServerResponse) => {
    try {
      const authHeader = req.headers.authorization
      const user = await resolveTokenUser(injector, authHeader, authInjector)
      if (!user) {
        res.writeHead(401, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ error: 'Unauthorized. Provide a valid Bearer token.' }))
        return
      }

      const sessionId = req.headers['mcp-session-id'] as string | undefined

      if (req.method === 'POST' && !sessionId) {
        if (sessionManager.size >= MAX_SESSIONS) {
          res.writeHead(429, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({ error: 'Too many active MCP sessions' }))
          return
        }

        const transport = new StreamableHTTPServerTransport({
          sessionIdGenerator: () => randomUUID(),
        })

        const userInjector = useUserIdentityContext({ injector, user })
        const mcp = createMcpServer(injector, userInjector)
        await mcp.connect(transport)

        await transport.handleRequest(req, res)

        if (transport.sessionId) {
          sessionManager.register(transport.sessionId, transport, userInjector)
        } else {
          await userInjector[Symbol.asyncDispose]()
        }
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
