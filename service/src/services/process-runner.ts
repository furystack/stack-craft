import { defineService, type Token } from '@furystack/inject'
import { type ChildProcess, spawn, spawnSync } from 'child_process'

import { LogStorageService } from './log-storage-service.js'
import type { ServiceLifecycleManager } from './service-lifecycle-manager.js'

const DEFAULT_WATCHDOG_GRACE_MS = 5000

/**
 * CommonJS script executed by `node -e`. Each managed service runs inside this
 * supervisor instead of a bare shell so that abrupt termination of the parent
 * (stack-craft itself crashing, IDE force-stop, `kill -9`) still tears down the
 * service tree.
 *
 * Inlined as a string so we don't depend on a separate `.js` file being copied
 * to `dist/` — works identically under `tsc`, `vitest`, and production runs.
 *
 * Behavior:
 *   - Spawns the user shell as a child with `stdio: ['ignore', 'inherit',
 *     'inherit']`. The supervisor was started detached by
 *     {@link ProcessRunnerImpl.spawnCommand}, so on POSIX the supervisor PID is
 *     the process-group leader and the shell and its descendants share that
 *     group. The shell inherits the supervisor's stdout/stderr (the pipes back
 *     to stack-craft) so log capture is unaffected, while the supervisor keeps
 *     its own stdin for parent-death detection.
 *   - Detects parent death via EOF on its own stdin. The parent holds the write
 *     end of that pipe and never writes to it; when the parent disappears the OS
 *     closes the end and the supervisor observes `end`/`close`. This is immune to
 *     PID reuse, unlike polling `process.kill(parentPid, 0)`. On detection it
 *     sends SIGTERM to the whole group, waits `WATCHDOG_GRACE_MS`, then SIGKILL —
 *     mirroring the escalation {@link ServiceLifecycleManager.shutdownAll} does
 *     from the parent side.
 *   - On Windows there are no process groups, so it uses `taskkill /T` against
 *     the child's pid (walks the descendant tree) and escalates to `/F`.
 *   - Forwards SIGTERM/SIGINT/SIGHUP from the parent into the same kill cascade
 *     so `killProcessGroup(supervisor, signal)` keeps working.
 *   - Mirrors the child exit code so callers see the same lifecycle as before.
 */
const SUPERVISOR_SCRIPT = `'use strict'
const { spawn, spawnSync } = require('child_process')

// node -e CODE -- <shell> <shellFlag> <command>
// node -e doesn't add a script placeholder to argv, so user args start at index 1.
const [shell, shellFlag, command] = process.argv.slice(1)
const graceMs = Number.parseInt(process.env.WATCHDOG_GRACE_MS, 10) || ${DEFAULT_WATCHDOG_GRACE_MS}

if (!shell || !shellFlag || command == null) {
  console.error('process-supervisor: missing arguments')
  process.exit(2)
}

const child = spawn(shell, [shellFlag, command], { stdio: ['ignore', 'inherit', 'inherit'] })

let cleaningUp = false

const killTree = (force) => {
  if (process.platform === 'win32') {
    if (child.pid == null) return
    const args = force
      ? ['/pid', String(child.pid), '/T', '/F']
      : ['/pid', String(child.pid), '/T']
    spawnSync('taskkill', args, { stdio: 'ignore' })
    return
  }
  try {
    // Targets the supervisor's own process group, so this process is signalled
    // too. SIGTERM is caught below and ignored once cleaningUp, so the supervisor
    // survives long enough to mirror the child's exit. The grace SIGKILL is
    // uncatchable and takes the supervisor down with the group if the child
    // outlives SIGTERM.
    process.kill(-process.pid, force ? 'SIGKILL' : 'SIGTERM')
  } catch {
    if (child.pid != null) {
      try { child.kill(force ? 'SIGKILL' : 'SIGTERM') } catch { /* gone */ }
    }
  }
}

const cleanup = () => {
  if (cleaningUp) return
  cleaningUp = true
  killTree(false)
  setTimeout(() => killTree(true), graceMs).unref()
}

// Parent-death detection: the parent owns the write end of our stdin and never
// writes; when it dies the OS closes that end and we get EOF here.
process.stdin.on('end', cleanup)
process.stdin.on('close', cleanup)
process.stdin.on('error', cleanup)
process.stdin.resume()

child.on('exit', (code) => {
  // Exit immediately whether the child died naturally or as part of the
  // kill cascade. The unref'd grace SIGKILL timer doesn't keep us alive.
  // ServiceLifecycleManager treats non-zero exits as graceful when stopping=true,
  // so mirroring the child's code (or 1 on signal) is enough signal for callers.
  process.exit(code != null ? code : 1)
})

// Forward graceful signals from the parent into the same kill cascade.
process.on('SIGTERM', cleanup)
process.on('SIGINT', cleanup)
process.on('SIGHUP', cleanup)
`

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
   * Spawns the user command inside a tiny Node supervisor (see
   * {@link SUPERVISOR_SCRIPT}). The supervisor watches the parent stack-craft
   * process via its stdin pipe and tears the child tree down if stack-craft dies
   * before it can issue a graceful stop — handles `kill -9`, IDE force-stop,
   * abrupt WSL exits, and any other path that bypasses
   * {@link ServiceLifecycleManager.shutdownAll}.
   */
  public spawnCommand(command: string, cwd: string, extraEnv?: Record<string, string>): ChildProcess {
    const isWindows = process.platform === 'win32'
    const shell = isWindows ? 'cmd.exe' : '/bin/sh'
    const shellFlag = isWindows ? '/c' : '-c'

    const child = spawn(process.execPath, ['-e', SUPERVISOR_SCRIPT, '--', shell, shellFlag, command], {
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
