import { type ChildProcess, spawn, spawnSync } from 'child_process'
import { dirname, extname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineService, type Token } from '@furystack/inject'

import { LogStorageService } from './log-storage-service.js'
import type { killProcessTree } from './process-supervisor.js'
import type { ServiceLifecycleManager } from './service-lifecycle-manager.js'

export type ManagedProcess = {
  serviceId: string
  process: ChildProcess
  purpose: 'run' | 'install' | 'build'
  processUid: string
  stopping?: boolean
}

/**
 * Environment variables allowed to pass through to spawned child processes.
 * Other host env vars are stripped to prevent leaking secrets.
 * Variables prefixed with STACK_CRAFT_ are always passed through.
 */
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
  'JAVA_HOME',
  'GOPATH',
  'GOROOT',
  'CARGO_HOME',
  'RUSTUP_HOME',
  'PYTHONPATH',
  'VIRTUAL_ENV',
  'CONDA_PREFIX',
  'NVM_DIR',
  'VOLTA_HOME',
  'FNM_DIR',
  'TMPDIR',
  'TMP',
  'TEMP',
  // Supervisor tuning — forwarded so WATCHDOG_GRACE_MS overrides reach node -e.
  'WATCHDOG_GRACE_MS',
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
export class ProcessRunnerImpl {
  constructor(private readonly logStorage: LogStorageService) {}

  public processes = new Map<string, ManagedProcess>()
  public pendingOperations = new Set<string>()

  private logBuffer: Array<{ serviceId: string; processUid: string; stream: 'stdout' | 'stderr'; line: string }> = []
  private flushTimer: ReturnType<typeof setTimeout> | null = null

  public addLogLine(serviceId: string, stream: 'stdout' | 'stderr', line: string): void {
    const managed = this.processes.get(serviceId)
    if (!managed) return
    this.logBuffer.push({ serviceId, processUid: managed.processUid, stream, line })
    if (!this.flushTimer) {
      this.flushTimer = setTimeout(
        () => void this.flushLogBuffer(),
        parseInt(process.env.LOG_FLUSH_INTERVAL_MS as string, 10) || 100,
      )
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

  /**
   * Spawns the user command inside the {@link killProcessTree process-supervisor}
   * module, which watches the parent stack-craft process via its stdin pipe and
   * tears the child tree down if stack-craft dies before it can issue a graceful
   * stop — handles `kill -9`, IDE force-stop, abrupt WSL exits, and any other
   * path that bypasses {@link ServiceLifecycleManager.shutdownAll}.
   *
   * The supervisor sibling is resolved with the same extension as this module so
   * it works both under `dist/` (`.js`) in production and under the source `.ts`
   * in dev/test (Node strips types natively, hence the `engines.node >= 24`).
   */
  public spawnCommand(command: string, cwd: string, extraEnv?: Record<string, string>): ChildProcess {
    const isWindows = process.platform === 'win32'
    const shell = isWindows ? 'cmd.exe' : '/bin/sh'
    const shellFlag = isWindows ? '/c' : '-c'

    const here = fileURLToPath(import.meta.url)
    const supervisorPath = join(dirname(here), `process-supervisor${extname(here)}`)

    const child = spawn(process.execPath, [supervisorPath, shell, shellFlag, command], {
      cwd,
      // stdin is a pipe the supervisor watches for EOF (parent-death signal);
      // stdout/stderr carry the child's output back for log capture.
      stdio: ['pipe', 'pipe', 'pipe'],
      env: { ...ProcessRunnerImpl.getSafeEnv(), ...extraEnv },
      detached: true,
    })

    // The supervisor watches this stdin pipe for EOF as its parent-death signal,
    // so leave the write end open. Swallow EPIPE so it can't crash us at teardown.
    child.stdin?.on('error', () => {})

    return child
  }

  /**
   * Kills a managed process and all its children by targeting the process group.
   * Falls back to killing just the shell process if the group kill fails.
   *
   * On Windows, `taskkill /T` (without `/F`) is used for non-`SIGKILL` signals so
   * console apps that handle CTRL-C / WM_CLOSE get a chance to flush state.
   * `/F` is reserved for `SIGKILL` to mirror the POSIX semantics that callers
   * (e.g. {@link ServiceLifecycleManager}) rely on for the graceful-then-force escalation.
   */
  public killProcessGroup(child: ChildProcess, signal: NodeJS.Signals): boolean {
    if (child.pid == null) return false
    try {
      if (process.platform === 'win32') {
        const args = signal === 'SIGKILL' ? ['/pid', String(child.pid), '/T', '/F'] : ['/pid', String(child.pid), '/T']
        spawnSync('taskkill', args, { stdio: 'ignore' })
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

export type ProcessRunner = ProcessRunnerImpl

export const ProcessRunner: Token<ProcessRunner, 'singleton'> = defineService({
  name: 'app/ProcessRunner',
  lifetime: 'singleton',
  factory: ({ inject }) => new ProcessRunnerImpl(inject(LogStorageService)),
})
