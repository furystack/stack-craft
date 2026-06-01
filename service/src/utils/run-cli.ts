import { spawn, spawnSync } from 'child_process'

export type RunCliOptions = {
  cwd?: string
  timeoutMs: number
  /**
   * Extra env applied on top of the inherited host env. Set a key to `undefined`
   * to strip an inherited variable (useful for blocking GUI prompt helpers like
   * `GIT_ASKPASS` that the host might have pre-configured).
   */
  env?: Record<string, string | undefined>
  /**
   * When supplied, an `abort` event triggers the same two-stage process-group
   * kill that the timeout uses. Wired to `Semaphore.execute`'s task signal so
   * in-flight ops cancel cleanly when the injector disposes.
   */
  signal?: AbortSignal
}

export type RunCliResult = {
  stdout: string
  stderr: string
}

const isWindows = process.platform === 'win32'

const SIGKILL_GRACE_MS = 2000

const buildEnv = (overrides?: Record<string, string | undefined>): NodeJS.ProcessEnv => {
  const env: NodeJS.ProcessEnv = { ...process.env }
  if (overrides) {
    for (const [key, value] of Object.entries(overrides)) {
      if (value === undefined) delete env[key]
      else env[key] = value
    }
  }
  return env
}

/**
 * Cross-platform process-group kill. POSIX uses negative pid against the group
 * leader (only works because we spawn with `detached: true`). Windows has no
 * POSIX-style process groups, so we use `taskkill /T` to walk the child tree,
 * escalating to `/F` only when the caller asked for `SIGKILL`.
 */
const killProcessGroup = (pid: number, signal: NodeJS.Signals): void => {
  try {
    if (isWindows) {
      const args = signal === 'SIGKILL' ? ['/pid', String(pid), '/T', '/F'] : ['/pid', String(pid), '/T']
      spawnSync('taskkill', args, { stdio: 'ignore' })
      return
    }
    try {
      process.kill(-pid, signal)
    } catch {
      // Group leader may have exited while children are still alive; fall back
      // to direct pid kill so we at least clear the immediate child.
      process.kill(pid, signal)
    }
  } catch {
    // Process likely exited between timeout firing and kill; nothing to do.
  }
}

/**
 * Spawn-based CLI runner used as the canonical replacement for
 * `promisify(execFile)` across the service layer.
 *
 * Why not `execFile`'s built-in `timeout`: when it fires it sends SIGTERM only
 * to the parent. Grandchildren (credential helpers, ssh, git-remote-https, gh
 * auth flows, user-script subshells) keep the inherited stdio pipes open, so
 * the promise can stay pending well past the nominal timeout
 * (nodejs/node#2098).
 *
 * What this helper does instead:
 *   - `detached: true` on POSIX so the child becomes a process-group leader
 *     and `process.kill(-pid, signal)` reaches the entire tree.
 *   - `taskkill /T` on Windows to walk the tree (escalating to `/F` on SIGKILL).
 *   - Two-stage kill on timeout: SIGTERM, then SIGKILL after a 2 s grace.
 *   - Stderr is captured and surfaced in the rejection error so callers see a
 *     useful diagnostic instead of the bare `"Command failed: <cmd>\n"` that
 *     `execFile` produces.
 */
export const runCli = (command: string, args: readonly string[], options: RunCliOptions): Promise<RunCliResult> =>
  new Promise<RunCliResult>((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: options.cwd,
      stdio: ['ignore', 'pipe', 'pipe'],
      env: buildEnv(options.env),
      // `detached: true` on POSIX makes the child a process-group leader so we
      // can kill the whole tree via `process.kill(-pid)`. On Windows it spawns
      // the child in its own console; `windowsHide` keeps the console invisible.
      detached: !isWindows,
      windowsHide: true,
    })

    let stdout = ''
    let stderr = ''
    let timedOut = false
    let aborted = false
    let killTimer: ReturnType<typeof setTimeout> | null = null

    child.stdout?.on('data', (chunk: Buffer) => {
      stdout += chunk.toString()
    })
    child.stderr?.on('data', (chunk: Buffer) => {
      stderr += chunk.toString()
    })

    const startKillSequence = (): void => {
      if (child.pid == null) return
      killProcessGroup(child.pid, 'SIGTERM')
      killTimer = setTimeout(() => {
        if (child.pid != null) killProcessGroup(child.pid, 'SIGKILL')
      }, SIGKILL_GRACE_MS)
    }

    const timeoutTimer = setTimeout(() => {
      timedOut = true
      startKillSequence()
    }, options.timeoutMs)

    const onAbort = (): void => {
      aborted = true
      startKillSequence()
    }

    if (options.signal) {
      if (options.signal.aborted) {
        onAbort()
      } else {
        options.signal.addEventListener('abort', onAbort, { once: true })
      }
    }

    const cleanup = (): void => {
      clearTimeout(timeoutTimer)
      if (killTimer) clearTimeout(killTimer)
      options.signal?.removeEventListener('abort', onAbort)
    }

    child.once('error', (error) => {
      cleanup()
      reject(error)
    })

    child.once('close', (code, signal) => {
      cleanup()
      const cwdPart = options.cwd ? ` in ${options.cwd}` : ''
      const stderrPart = stderr.trim() ? `\nstderr: ${stderr.trim()}` : ''
      const commandLine = [command, ...args].join(' ')

      if (aborted) {
        const reason = options.signal?.reason
        reject(reason instanceof Error ? reason : new Error(`${commandLine}${cwdPart} aborted${stderrPart}`))
        return
      }

      if (timedOut) {
        reject(new Error(`${commandLine}${cwdPart} timed out after ${options.timeoutMs}ms${stderrPart}`))
        return
      }

      if (code !== 0) {
        const signalPart = signal ? ` (signal ${signal})` : ''
        reject(new Error(`${commandLine}${cwdPart} exited with code ${code ?? 'null'}${signalPart}${stderrPart}`))
        return
      }

      resolve({ stdout, stderr })
    })
  })
