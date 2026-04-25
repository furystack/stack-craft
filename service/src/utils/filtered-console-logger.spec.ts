import { createInjector } from '@furystack/inject'
import type { LeveledLogEntry, Logger } from '@furystack/logging'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

describe('FilteredConsoleLogger', () => {
  const originalEnv = process.env.LOG_LEVEL

  beforeEach(() => {
    vi.spyOn(console, 'log').mockImplementation(() => {})
    vi.resetModules()
  })

  afterEach(() => {
    if (originalEnv === undefined) {
      delete process.env.LOG_LEVEL
    } else {
      process.env.LOG_LEVEL = originalEnv
    }
    vi.restoreAllMocks()
  })

  const createEntry = (level: LeveledLogEntry<unknown>['level'], message: string): LeveledLogEntry<unknown> => ({
    scope: 'test',
    message,
    level,
  })

  const loadLogger = async (): Promise<Logger> => {
    const { FilteredConsoleLogger } = await import('./filtered-console-logger.js')
    const injector = createInjector()
    return injector.get(FilteredConsoleLogger)
  }

  it('should default to verbose when LOG_LEVEL is not set', async () => {
    delete process.env.LOG_LEVEL
    const logger = await loadLogger()

    await logger.addEntry(createEntry('verbose', 'verbose msg'))
    await logger.addEntry(createEntry('debug', 'debug msg'))
    await logger.addEntry(createEntry('information', 'info msg'))

    expect(console.log).toHaveBeenCalledTimes(3)
  })

  it('should log entries at or above the configured level', async () => {
    process.env.LOG_LEVEL = 'information'
    const logger = await loadLogger()

    await logger.addEntry(createEntry('information', 'info msg'))
    await logger.addEntry(createEntry('warning', 'warn msg'))
    await logger.addEntry(createEntry('error', 'error msg'))
    await logger.addEntry(createEntry('fatal', 'fatal msg'))

    expect(console.log).toHaveBeenCalledTimes(4)
  })

  it('should skip entries below the configured level', async () => {
    process.env.LOG_LEVEL = 'information'
    const logger = await loadLogger()

    await logger.addEntry(createEntry('verbose', 'verbose msg'))
    await logger.addEntry(createEntry('debug', 'debug msg'))

    expect(console.log).not.toHaveBeenCalled()
  })

  it('should respect LOG_LEVEL=information (skips verbose and debug)', async () => {
    process.env.LOG_LEVEL = 'information'
    const logger = await loadLogger()

    await logger.addEntry(createEntry('verbose', 'should skip'))
    await logger.addEntry(createEntry('debug', 'should skip'))
    await logger.addEntry(createEntry('information', 'should log'))
    await logger.addEntry(createEntry('warning', 'should log'))

    expect(console.log).toHaveBeenCalledTimes(2)
  })

  it('should respect LOG_LEVEL=warning (skips verbose, debug, information)', async () => {
    process.env.LOG_LEVEL = 'warning'
    const logger = await loadLogger()

    await logger.addEntry(createEntry('verbose', 'should skip'))
    await logger.addEntry(createEntry('debug', 'should skip'))
    await logger.addEntry(createEntry('information', 'should skip'))
    await logger.addEntry(createEntry('warning', 'should log'))
    await logger.addEntry(createEntry('error', 'should log'))
    await logger.addEntry(createEntry('fatal', 'should log'))

    expect(console.log).toHaveBeenCalledTimes(3)
  })
})
