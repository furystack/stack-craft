import type { MockInstance } from 'vitest'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mockLogger = vi.hoisted(() => ({
  information: vi.fn().mockResolvedValue(undefined),
  fatal: vi.fn().mockReturnValue({
    catch: (cb: () => void) => {
      cb?.()
      return Promise.resolve()
    },
  }),
}))

const mockServerManager = vi.hoisted(() => ({}))

vi.mock('@furystack/logging', () => ({
  getLogger: () => ({
    withScope: () => mockLogger,
  }),
}))

vi.mock('@furystack/rest-service', () => ({
  ServerManager: mockServerManager,
}))

describe('attachShutdownHandler', () => {
  let processExitSpy: MockInstance
  let registeredHandlers: Map<string, (...args: unknown[]) => void>

  beforeEach(() => {
    registeredHandlers = new Map()
    vi.spyOn(process, 'once').mockImplementation(((event: string, handler: unknown) => {
      registeredHandlers.set(event, handler as (...args: unknown[]) => void)
      return process
    }) as typeof process.once)
    processExitSpy = vi.spyOn(process, 'exit').mockImplementation((() => undefined) as never)
    mockLogger.information.mockClear()
    mockLogger.fatal.mockClear()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  const triggerAndWaitForExit = async (handler: (...args: unknown[]) => void, ...args: unknown[]) => {
    handler(...args)
    await vi.waitFor(() => expect(processExitSpy).toHaveBeenCalled())
  }

  it('should register signal handlers for SIGINT, SIGTERM, uncaughtException, and unhandledRejection', async () => {
    const { attachShutdownHandler } = await import('./shutdown-handler.js')
    const injector = {
      cachedSingletons: new Map(),
      getInstance: vi.fn(),
      [Symbol.asyncDispose]: vi.fn().mockResolvedValue(undefined),
    }

    await attachShutdownHandler(injector as never)

    expect(registeredHandlers.has('SIGINT')).toBe(true)
    expect(registeredHandlers.has('SIGTERM')).toBe(true)
    expect(registeredHandlers.has('uncaughtException')).toBe(true)
    expect(registeredHandlers.has('unhandledRejection')).toBe(true)
  })

  it('should prevent double shutdown via the isShuttingDown guard', async () => {
    const { attachShutdownHandler } = await import('./shutdown-handler.js')
    const injectorDispose = vi.fn().mockResolvedValue(undefined)
    const injector = {
      cachedSingletons: new Map(),
      getInstance: vi.fn(),
      [Symbol.asyncDispose]: injectorDispose,
    }

    await attachShutdownHandler(injector as never)

    const sigintHandler = registeredHandlers.get('SIGINT')!
    await triggerAndWaitForExit(sigintHandler)

    injectorDispose.mockClear()
    processExitSpy.mockClear()

    sigintHandler()
    await new Promise((resolve) => setTimeout(resolve, 50))

    expect(injectorDispose).not.toHaveBeenCalled()
  })

  it('should dispose ServerManager when it exists in the injector', async () => {
    const { attachShutdownHandler } = await import('./shutdown-handler.js')
    const serverManagerDispose = vi.fn().mockResolvedValue(undefined)

    const cachedSingletons = new Map()
    cachedSingletons.set(mockServerManager, {})

    const injector = {
      cachedSingletons,
      getInstance: vi.fn().mockReturnValue({
        [Symbol.asyncDispose]: serverManagerDispose,
      }),
      [Symbol.asyncDispose]: vi.fn().mockResolvedValue(undefined),
    }

    await attachShutdownHandler(injector as never)

    await triggerAndWaitForExit(registeredHandlers.get('SIGINT')!)

    expect(injector.getInstance).toHaveBeenCalledWith(mockServerManager)
    expect(serverManagerDispose).toHaveBeenCalled()
  })

  it('should dispose the injector during shutdown', async () => {
    const { attachShutdownHandler } = await import('./shutdown-handler.js')
    const injectorDispose = vi.fn().mockResolvedValue(undefined)
    const injector = {
      cachedSingletons: new Map(),
      getInstance: vi.fn(),
      [Symbol.asyncDispose]: injectorDispose,
    }

    await attachShutdownHandler(injector as never)

    await triggerAndWaitForExit(registeredHandlers.get('SIGINT')!)

    expect(injectorDispose).toHaveBeenCalled()
  })

  it('should log fatal on error during shutdown', async () => {
    const { attachShutdownHandler } = await import('./shutdown-handler.js')
    const injector = {
      cachedSingletons: new Map(),
      getInstance: vi.fn(),
      [Symbol.asyncDispose]: vi.fn().mockRejectedValue(new Error('dispose failed')),
    }

    await attachShutdownHandler(injector as never)

    await triggerAndWaitForExit(registeredHandlers.get('SIGINT')!)

    expect(mockLogger.fatal).toHaveBeenCalledWith(
      expect.objectContaining({
        message: 'Error during shutdown',
      }),
    )
  })
})
