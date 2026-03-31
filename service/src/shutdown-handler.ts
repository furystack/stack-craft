import type { Injector } from '@furystack/inject'
import { getLogger } from '@furystack/logging'
import { ServerManager } from '@furystack/rest-service'

export const attachShutdownHandler = async (i: Injector) => {
  const logger = getLogger(i).withScope('shutdown-handler')

  await logger.information({ message: '💤  Attaching shutdown handler...' })

  let isShuttingDown = false

  const onExit = async ({ code, reason, error }: { code: number; reason: string; error?: unknown }) => {
    if (isShuttingDown) return
    isShuttingDown = true

    try {
      if (code) {
        const errorMessage = error instanceof Error ? error.message : undefined
        const errorStack = error instanceof Error ? error.stack : undefined
        await logger.fatal({
          message: `Something bad happened, starting shutdown with code '${code}' due '${reason}'`,
          data: {
            code,
            reason,
            error,
            errorMessage,
            errorStack,
          },
        })
      } else {
        await logger.information({
          message: `Shutting down gracefully due '${reason}'`,
          data: {
            code,
            reason,
            error,
          },
        })
      }
      if (i.cachedSingletons.get(ServerManager)) {
        await i.getInstance(ServerManager)[Symbol.asyncDispose]()
      }
      await i[Symbol.asyncDispose]()
    } catch (e) {
      await logger.fatal({ message: 'Error during shutdown', data: { error: e } }).catch(() => {
        // Last resort: logger itself failed
        console.error('Error during shutdown (logger unavailable)', e)
      })
      process.exit(1)
    }
    process.exit(code)
  }

  // catches ctrl+c event
  process.once('SIGINT', () => void onExit({ code: 0, reason: 'SIGINT' }))
  process.once('SIGTERM', () => void onExit({ code: 0, reason: 'SIGTERM' }))

  if (process.platform !== 'win32') {
    process.once('SIGQUIT', () => void onExit({ code: 0, reason: 'SIGQUIT' }))
    // catches "kill pid" (for example: nodemon restart)
    process.once('SIGUSR1', () => void onExit({ code: 0, reason: 'SIGUSR1' }))
    process.once('SIGUSR2', () => void onExit({ code: 0, reason: 'SIGUSR2' }))
  } else {
    process.once('SIGBREAK', () => void onExit({ code: 0, reason: 'SIGBREAK' }))
  }

  // catches uncaught exceptions
  process.once('uncaughtException', (error) => {
    void onExit({ code: 1, reason: 'uncaughtException', error })
  })

  process.once('unhandledRejection', (error) => void onExit({ code: 1, reason: 'unhandledRejection', error }))
}
