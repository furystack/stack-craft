import type { Injector } from '@furystack/inject'
import { getLogger } from '@furystack/logging'
import { createServer } from 'http'
import { handleMcpRequest } from './mcp-server.js'

/**
 * Sets up the MCP endpoint on a separate port.
 * MCP clients connect to this endpoint using Streamable HTTP transport.
 */
export const setupMcp = async (injector: Injector) => {
  const logger = getLogger(injector).withScope('MCP')
  const port = parseInt(process.env.MCP_PORT as string, 10) || 9091

  const server = createServer(async (req, res) => {
    if (req.url === '/mcp' || req.url?.startsWith('/mcp?')) {
      try {
        await handleMcpRequest(injector, req, res)
      } catch (error) {
        await logger.error({ message: 'MCP request error', data: { error } })
        if (!res.headersSent) {
          res.writeHead(500, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({ error: 'Internal server error' }))
        }
      }
    } else {
      res.writeHead(404)
      res.end('Not found')
    }
  })

  server.listen(port, () => {
    void logger.information({ message: `MCP server listening on port ${port}` })
  })
}
