import { useSystemIdentityContext } from '@furystack/core'
import { Injectable } from '@furystack/inject'
import type { Injector } from '@furystack/inject'
import { getLogger } from '@furystack/logging'
import type { Server } from 'http'
import { createServer } from 'http'
import { createMcpRequestHandler, McpSessionManager } from './mcp-server.js'

@Injectable({ lifetime: 'singleton' })
export class McpHttpServer {
  private server: Server | null = null
  private sessionManager: McpSessionManager | null = null
  /** System-level injector used only for Bearer token resolution in {@link resolveTokenUser}. */
  private authInjector: Injector | null = null

  public listen(injector: Injector, port: number, host: string) {
    const logger = getLogger(injector).withScope('MCP')

    this.authInjector = useSystemIdentityContext({ injector })
    this.sessionManager = new McpSessionManager()
    const handleRequest = createMcpRequestHandler(injector, this.sessionManager, this.authInjector)

    this.server = createServer((req, res) => {
      if (req.url === '/mcp' || req.url?.startsWith('/mcp?')) {
        handleRequest(req, res).catch((error) => {
          void logger.error({ message: 'MCP request error', data: { error } })
          if (!res.headersSent) {
            res.writeHead(500, { 'Content-Type': 'application/json' })
            res.end(JSON.stringify({ error: 'Internal server error' }))
          }
        })
      } else {
        res.writeHead(404)
        res.end('Not found')
      }
    })

    this.server.listen(port, host, () => {
      void logger.information({ message: `MCP server listening on ${host}:${port}` })
    })
  }

  public async [Symbol.asyncDispose]() {
    this.sessionManager?.[Symbol.dispose]()
    this.sessionManager = null
    if (this.server) {
      await new Promise<void>((resolve) => this.server!.close(() => resolve()))
      this.server = null
    }
    await this.authInjector?.[Symbol.asyncDispose]()
    this.authInjector = null
  }
}

export const getMcpPort = (env = process.env) => parseInt(env.MCP_PORT as string, 10) || 9091

export const getMcpHost = (env = process.env) => env.MCP_HOST || '127.0.0.1'

/**
 * Sets up the MCP endpoint on a separate port.
 * MCP clients connect to this endpoint using Streamable HTTP transport.
 */
export const setupMcp = (injector: Injector) => {
  const port = getMcpPort()
  const host = getMcpHost()
  const mcpServer = injector.getInstance(McpHttpServer)
  mcpServer.listen(injector, port, host)
}
