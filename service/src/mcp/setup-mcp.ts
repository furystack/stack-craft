import { Injectable } from '@furystack/inject'
import type { Injector } from '@furystack/inject'
import { getLogger } from '@furystack/logging'
import type { Server } from 'http'
import { createServer } from 'http'
import { handleMcpRequest } from './mcp-server.js'

@Injectable({ lifetime: 'singleton' })
export class McpHttpServer {
  private server: Server | null = null

  public listen(injector: Injector, port: number) {
    const logger = getLogger(injector).withScope('MCP')

    this.server = createServer((req, res) => {
      if (req.url === '/mcp' || req.url?.startsWith('/mcp?')) {
        handleMcpRequest(injector, req, res).catch((error) => {
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

    this.server.listen(port, () => {
      void logger.information({ message: `MCP server listening on port ${port}` })
    })
  }

  public async [Symbol.asyncDispose]() {
    if (this.server) {
      await new Promise<void>((resolve) => this.server!.close(() => resolve()))
      this.server = null
    }
  }
}

/**
 * Sets up the MCP endpoint on a separate port.
 * MCP clients connect to this endpoint using Streamable HTTP transport.
 */
export const setupMcp = (injector: Injector) => {
  const port = parseInt(process.env.MCP_PORT as string, 10) || 9091
  const mcpServer = injector.getInstance(McpHttpServer)
  mcpServer.listen(injector, port)
}
