import { type ChildProcess, spawn, spawnSync } from 'node:child_process'
import { pathToFileURL } from 'node:url'

const DEFAULT_WATCHDOG_GRACE_MS = 5000

/**
 * Sends a termination signal to the whole descendant tree of `child`.
 *
 * On POSIX this signals the supervisor's own process group (`-process.pid`),
 * which the shell and its descendants share because the supervisor was started
 * detached as the group leader. The supervisor is therefore signalled too:
 * SIGTERM is caught by {@link runSupervisor} and ignored once cleanup is in
 * flight, so the supervisor survives long enough to mirror the child's exit;
 * the uncatchable grace SIGKILL takes the whole group down if the child outlives
 * SIGTERM. On Windows there are no process groups, so `taskkill /T` walks the
 * descendant tree by pid and `/F` forces termination.
 *
 * @param child The shell process spawned by the supervisor.
 * @param force `true` escalates to SIGKILL / `taskkill /F`; `false` is graceful.
 */
export const killProcessTree = (child: ChildProcess, force: boolean): void => {
  if (process.platform === 'win32') {
    if (child.pid == null) return
    const args = force ? ['/pid', String(child.pid), '/T', '/F'] : ['/pid', String(child.pid), '/T']
    spawnSync('taskkill', args, { stdio: 'ignore' })
    return
  }
  try {
    process.kill(-process.pid, force ? 'SIGKILL' : 'SIGTERM')
  } catch {
    if (child.pid != null) {
      try {
        child.kill(force ? 'SIGKILL' : 'SIGTERM')
      } catch {
        // Child already gone — nothing left to signal.
      }
    }
  }
}

/**
 * Entry point executed when this module is spawned as a child process by
 * {@link ProcessRunnerImpl.spawnCommand}. Wraps the user command so abrupt
 * termination of the parent (stack-craft crashing, IDE force-stop, `kill -9`,
 * abrupt WSL exit) still tears down the service tree.
 *
 * Parent death is detected via EOF on stdin: the parent owns the write end and
 * never writes to it, so the OS closes it the instant the parent dies. This is
 * immune to PID reuse, unlike polling `process.kill(parentPid, 0)`. On detection
 * (or a forwarded SIGTERM/SIGINT/SIGHUP) it escalates SIGTERM → SIGKILL across
 * the tree after `WATCHDOG_GRACE_MS` (default {@link DEFAULT_WATCHDOG_GRACE_MS}).
 *
 * @see {@link ProcessRunnerImpl.spawnCommand} for the parent-side wiring.
 */
const runSupervisor = (): void => {
  // node <script> <shell> <shellFlag> <command> — user args start at index 2.
  const [shell, shellFlag, command] = process.argv.slice(2)
  const graceMs = Number.parseInt(process.env.WATCHDOG_GRACE_MS ?? '', 10) || DEFAULT_WATCHDOG_GRACE_MS

  if (!shell || !shellFlag || command == null) {
    process.stderr.write('process-supervisor: missing arguments\n')
    process.exit(2)
  }

  // The shell inherits the supervisor's stdout/stderr (the pipes back to
  // stack-craft) for log capture, while the supervisor keeps its own stdin for
  // parent-death detection.
  const child = spawn(shell, [shellFlag, command], { stdio: ['ignore', 'inherit', 'inherit'] })

  let cleaningUp = false
  const cleanup = (): void => {
    if (cleaningUp) return
    cleaningUp = true
    killProcessTree(child, false)
    setTimeout(() => killProcessTree(child, true), graceMs).unref()
  }

  process.stdin.on('end', cleanup)
  process.stdin.on('close', cleanup)
  process.stdin.on('error', cleanup)
  process.stdin.resume()

  // Mirror the child's lifecycle. ServiceLifecycleManager treats non-zero exits
  // as graceful when it initiated the stop, so 1-on-signal is enough signal.
  child.on('exit', (code) => process.exit(code ?? 1))

  process.on('SIGTERM', cleanup)
  process.on('SIGINT', cleanup)
  process.on('SIGHUP', cleanup)
}

const isEntryPoint = (): boolean =>
  process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href

if (isEntryPoint()) {
  runSupervisor()
}
