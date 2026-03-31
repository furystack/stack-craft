import type { IncomingMessage, ServerResponse } from 'http'
import type { Injector } from '@furystack/inject'
import { getLogger } from '@furystack/logging'

/**
 * HTTP access logging middleware that logs method, path, status code, and
 * duration for every completed request using the FuryStack logger.
 */
export const useRequestLogger = (injector: Injector) => {
  const logger = getLogger(injector).withScope('http')

  return (req: IncomingMessage, res: ServerResponse, next: () => void) => {
    const start = Date.now()
    const method = req.method ?? 'UNKNOWN'
    const url = req.url ?? '/'

    res.on('finish', () => {
      const duration = Date.now() - start
      const { statusCode } = res
      const level = statusCode >= 500 ? 'error' : statusCode >= 400 ? 'warning' : 'verbose'

      void logger[level]({
        message: `${method} ${url} ${statusCode} ${duration}ms`,
        data: { method, url, statusCode, duration },
      })
    })

    next()
  }
}
