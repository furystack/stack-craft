import { usingAsync } from '@furystack/utils'
import { describe, expect, it } from 'vitest'

import type { LogStorageService } from './log-storage-service.js'
import { ProcessRunnerImpl } from './process-runner.js'
import '../test-shims.js'

const isAlive = (pid: number): boolean => {
  try {
    process.kill(pid, 0)
    return true
  } catch {
    return false
  }
}

const waitFor = async (predicate: () => boolean, timeoutMs: number): Promise<boolean> => {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    if (predicate()) return true
    await new Promise((resolve) => setTimeout(resolve, 25))
  }
  return predicate()
}

const noopLogStorage = { addEntry: async () => undefined } as unknown as LogStorageService

// The supervisor is spawned as a `.ts` file under vitest, so the real-spawn path
// needs a Node that strips types natively (>= 24, the project's engines floor).
const hasNativeTypeScript = Boolean((process.features as { typescript?: unknown }).typescript)

// POSIX-only: the watchdog reaps via process-group signals. The Windows path
// uses taskkill and cannot be exercised on the Linux CI runner.
describe.skipIf(process.platform === 'win32' || !hasNativeTypeScript)('ProcessRunner watchdog (integration)', () => {
  it('reaps the child tree when the parent (stdin) goes away', async () => {
    const original = process.env.WATCHDOG_GRACE_MS
    process.env.WATCHDOG_GRACE_MS = '200'

    try {
      await usingAsync(new ProcessRunnerImpl(noopLogStorage), async (runner) => {
        // Background a long sleep and print its pid; the supervisor's group includes it.
        const child = runner.spawnCommand('sleep 30 & echo "GRANDCHILD:$!"; wait', process.cwd())

        let output = ''
        child.stdout?.on('data', (data: Buffer) => {
          output += data.toString()
        })

        const sawPid = await waitFor(() => /GRANDCHILD:\d+/.test(output), 3000)
        expect(sawPid).toBe(true)

        const grandchildPid = Number.parseInt(/GRANDCHILD:(\d+)/.exec(output)?.[1] ?? '', 10)
        expect(Number.isFinite(grandchildPid)).toBe(true)
        expect(isAlive(grandchildPid)).toBe(true)

        // Simulate abrupt parent death: closing the stdin write end is exactly what
        // the OS does to the supervisor's stdin when the real parent process dies.
        child.stdin?.end()

        const grandchildReaped = await waitFor(() => !isAlive(grandchildPid), 3000)
        const supervisorReaped = await waitFor(() => child.exitCode !== null || child.killed, 3000)

        expect(grandchildReaped).toBe(true)
        expect(supervisorReaped).toBe(true)
      })
    } finally {
      if (original === undefined) {
        delete process.env.WATCHDOG_GRACE_MS
      } else {
        process.env.WATCHDOG_GRACE_MS = original
      }
    }
  })
})
