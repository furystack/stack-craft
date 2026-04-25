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

vi.mock('@furystack/logging', () => ({
  getLogger: () => ({
    withScope: () => mockLogger,
  }),
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

  const buildMockInjector = (overrides?: { dispose?: () => Promise<void> }) => ({
    [Symbol.asyncDispose]: vi.fn().mockImplementation(overrides?.dispose ?? (() => Promise.resolve())),
  })

  it('should register signal handlers for SIGINT, SIGTERM, uncaughtException, and unhandledRejection', async () => {
    const { attachShutdownHandler } = await import('./shutdown-handler.js')
    const injector = buildMockInjector()

    await attachShutdownHandler(injector as never)

    expect(registeredHandlers.has('SIGINT')).toBe(true)
    expect(registeredHandlers.has('SIGTERM')).toBe(true)
    expect(registeredHandlers.has('uncaughtException')).toBe(true)
    expect(registeredHandlers.has('unhandledRejection')).toBe(true)
  })

  it('should prevent double shutdown via the isShuttingDown guard', async () => {
    const { attachShutdownHandler } = await import('./shutdown-handler.js')
    const injector = buildMockInjector()

    await attachShutdownHandler(injector as never)

    const sigintHandler = registeredHandlers.get('SIGINT')!
    await triggerAndWaitForExit(sigintHandler)
    ;(injector[Symbol.asyncDispose] as ReturnType<typeof vi.fn>).mockClear()
    processExitSpy.mockClear()

    sigintHandler()
    await new Promise((resolve) => setTimeout(resolve, 50))

    expect(injector[Symbol.asyncDispose]).not.toHaveBeenCalled()
  })

  it('should dispose the injector during shutdown', async () => {
    const { attachShutdownHandler } = await import('./shutdown-handler.js')
    const injector = buildMockInjector()

    await attachShutdownHandler(injector as never)

    await triggerAndWaitForExit(registeredHandlers.get('SIGINT')!)

    expect(injector[Symbol.asyncDispose]).toHaveBeenCalled()
  })

  it('should log fatal on error during shutdown', async () => {
    const { attachShutdownHandler } = await import('./shutdown-handler.js')
    const injector = buildMockInjector({ dispose: () => Promise.reject(new Error('dispose failed')) })

    await attachShutdownHandler(injector as never)

    await triggerAndWaitForExit(registeredHandlers.get('SIGINT')!)

    expect(mockLogger.fatal).toHaveBeenCalledWith(
      expect.objectContaining({
        message: 'Error during shutdown',
      }),
    )
  })
})
