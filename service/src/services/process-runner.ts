import { Injectable, Injected } from '@furystack/inject'
import { type ChildProcess, spawn, spawnSync } from 'child_process'

import { LogStorageService } from './log-storage-service.js'

export type ManagedProcess = {
  serviceId: string
  process: ChildProcess
  purpose: 'run' | 'install' | 'build'
  processUid: string
}

const SAFE_ENV_KEYS = new Set([
  'PATH',
  'HOME',
  'USER',
  'SHELL',
  'LANG',
  'LC_ALL',
  'TERM',
  'NODE_ENV',
  'NODE_OPTIONS',
  'NPM_CONFIG_REGISTRY',
  'YARN_CACHE_FOLDER',
  'DOTNET_ROOT',
  'DOTNET_CLI_HOME',
  'NUGET_PACKAGES',
  'TMPDIR',
  'TMP',
  'TEMP',
  // Windows-specific
  'USERPROFILE',
  'APPDATA',
  'LOCALAPPDATA',
  'SYSTEMROOT',
  'COMSPEC',
  'PATHEXT',
])

/**
 * Low-level service responsible for spawning and killing child processes,
 * buffering their stdout/stderr output, and flushing log lines to storage.
 */
@Injectable({ lifetime: 'singleton' })
export class ProcessRunner {
  public processes = new Map<string, ManagedProcess>()
  public pendingOperations = new Set<string>()

  @Injected(LogStorageService)
  declare private logStorage: LogStorageService

  private logBuffer: Array<{ serviceId: string; processUid: string; stream: 'stdout' | 'stderr'; line: string }> = []
  private flushTimer: ReturnType<typeof setTimeout> | null = null

  public addLogLine(serviceId: string, stream: 'stdout' | 'stderr', line: string): void {
    const managed = this.processes.get(serviceId)
    if (!managed) return
    this.logBuffer.push({ serviceId, processUid: managed.processUid, stream, line })
    if (!this.flushTimer) {
      this.flushTimer = setTimeout(() => void this.flushLogBuffer(), 100)
    }
  }

  public async flushLogBuffer(): Promise<void> {
    this.flushTimer = null
    const batch = this.logBuffer.splice(0)
    for (const entry of batch) {
      await this.logStorage.addEntry(entry.serviceId, entry.processUid, entry.stream, entry.line)
    }
  }

  public static getSafeEnv(): NodeJS.ProcessEnv {
    const env: NodeJS.ProcessEnv = {}
    for (const key of Object.keys(process.env)) {
      if (SAFE_ENV_KEYS.has(key.toUpperCase()) || key.startsWith('STACK_CRAFT_')) {
        env[key] = process.env[key]
      }
    }
    return env
  }

  public spawnCommand(command: string, cwd: string, extraEnv?: Record<string, string>): ChildProcess {
    const isWindows = process.platform === 'win32'
    const shell = isWindows ? 'cmd.exe' : '/bin/sh'
    const shellFlag = isWindows ? '/c' : '-c'

    return spawn(shell, [shellFlag, command], {
      cwd,
      stdio: ['ignore', 'pipe', 'pipe'],
      env: { ...ProcessRunner.getSafeEnv(), ...extraEnv },
      detached: true,
    })
  }

  /**
   * Kills a managed process and all its children by targeting the process group.
   * Falls back to killing just the shell process if the group kill fails.
   */
  public killProcessGroup(child: ChildProcess, signal: NodeJS.Signals): boolean {
    if (child.pid == null) return false
    try {
      if (process.platform === 'win32') {
        spawnSync('taskkill', ['/pid', String(child.pid), '/T', '/F'], { stdio: 'ignore' })
      } else {
        process.kill(-child.pid, signal)
      }
      return true
    } catch {
      try {
        return child.kill(signal)
      } catch {
        return false
      }
    }
  }

  public async [Symbol.asyncDispose]() {
    if (this.flushTimer) {
      clearTimeout(this.flushTimer)
      this.flushTimer = null
    }
    await this.flushLogBuffer()
  }
}
