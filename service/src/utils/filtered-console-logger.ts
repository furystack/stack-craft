import { Injectable } from '@furystack/inject'
import { AbstractLogger, verboseFormat } from '@furystack/logging'
import type { LeveledLogEntry, LogLevel } from '@furystack/logging'

const LOG_LEVELS: LogLevel[] = ['verbose', 'debug', 'information', 'warning', 'error', 'fatal']

@Injectable({ lifetime: 'scoped' })
export class FilteredConsoleLogger extends AbstractLogger {
  private readonly minLevel: number

  constructor() {
    super()
    const envLevel = (process.env.LOG_LEVEL ?? 'verbose') as LogLevel
    this.minLevel = LOG_LEVELS.indexOf(envLevel)
  }

  public async addEntry<T>(entry: LeveledLogEntry<T>): Promise<void> {
    const entryLevel = LOG_LEVELS.indexOf(entry.level)
    if (entryLevel < this.minLevel) {
      return
    }
    const data = verboseFormat(entry)
    console.log(...data)
  }
}
