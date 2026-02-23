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
import { registerServiceTools } from './tools/service-tools.js'
import { registerStackTools } from './tools/stack-tools.js'
import { registerSystemTools } from './tools/system-tools.js'

export const createMcpServer = (injector: Injector, elevated: Injector) => {
  const mcp = new McpServer({ name: 'stackcraft', version: '1.0.0' }, { capabilities: { tools: {} } })

  registerStackTools(mcp, injector, elevated)
  registerServiceTools(mcp, injector, elevated)
  registerPrerequisiteTools(mcp, injector, elevated)
  registerRepositoryTools(mcp, injector, elevated)
  registerEnvVariableTools(mcp, injector, elevated)
  registerSystemTools(mcp, injector, elevated)

  return mcp
}

const SESSION_TTL_MS = 30 * 60 * 1000
const MAX_SESSIONS = 50

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

  public get size(): number {
    return this.transports.size
  }

  public register(sessionId: string, transport: StreamableHTTPServerTransport) {
    this.transports.set(sessionId, { transport, lastActivityAt: Date.now() })
    transport.onclose = () => this.transports.delete(sessionId)
  }

  public get(sessionId: string): TransportEntry | undefined {
    return this.transports.get(sessionId)
  }

  public [Symbol.dispose]() {
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
      const user = await resolveTokenUser(injector, authHeader, elevated)
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

        const mcp = createMcpServer(injector, elevated)
        await mcp.connect(transport)

        await transport.handleRequest(req, res)

        if (transport.sessionId) {
          sessionManager.register(transport.sessionId, transport)
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
