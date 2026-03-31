import { createServer } from 'net'

/** Binds to port 0 so the OS assigns a free port, then closes the server and returns the port number */
export const getAvailablePort = (): Promise<number> =>
  new Promise((resolve, reject) => {
    const server = createServer()
    server.listen(0, () => {
      const { port } = server.address() as { port: number }
      server.close(() => resolve(port))
    })
    server.on('error', reject)
  })
