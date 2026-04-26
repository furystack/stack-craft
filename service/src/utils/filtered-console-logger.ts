import { defineService, type Token } from '@furystack/inject'
import { createLogger, verboseFormat } from '@furystack/logging'
import type { Logger, LogLevel } from '@furystack/logging'

const LOG_LEVELS: LogLevel[] = ['verbose', 'debug', 'information', 'warning', 'error', 'fatal']

const minLevelIndex = (): number => {
  const envLevel = (process.env.LOG_LEVEL ?? 'verbose') as LogLevel
  return LOG_LEVELS.indexOf(envLevel)
}

export const FilteredConsoleLogger: Token<Logger, 'singleton'> = defineService({
  name: 'app/FilteredConsoleLogger',
  lifetime: 'singleton',
  factory: () => {
    const minLevel = minLevelIndex()
    return createLogger(async (entry) => {
      const entryLevel = LOG_LEVELS.indexOf(entry.level)
      if (entryLevel < minLevel) return
      const data = verboseFormat(entry)
      console.log(...data)
    })
  },
})
