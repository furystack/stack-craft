import { Injector } from '@furystack/inject'
import { useLogging, VerboseConsoleLogger } from '@furystack/logging'
import { usingAsync } from '@furystack/utils'
import { EventEmitter } from 'events'
import { PassThrough } from 'stream'
import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from 'vitest'

import { GitService } from './git-service.js'

vi.mock('child_process', () => ({
  spawn: vi.fn(),
  spawnSync: vi.fn(),
}))

const childProcess = await import('child_process')
const spawnMock = childProcess.spawn as unknown as MockInstance<typeof childProcess.spawn>
const spawnSyncMock = childProcess.spawnSync as unknown as MockInstance<typeof childProcess.spawnSync>

type FakeChild = EventEmitter & {
  pid: number
  stdout: PassThrough
  stderr: PassThrough
}

const createFakeChild = (pid = 12345): FakeChild => {
  const child = new EventEmitter() as FakeChild
  child.pid = pid
  child.stdout = new PassThrough()
  child.stderr = new PassThrough()
  return child
}

/**
 * GitService methods `await this.logger.information(...)` before invoking `runGit`,
 * so the `spawn`-returned child has no listeners yet right after the call returns.
 * Yield to the I/O queue until runGit has registered its `close` listener; only
 * then is it safe to emit lifecycle events on the fake child.
 */
const awaitListenersAttached = async (child: FakeChild): Promise<void> => {
  for (let i = 0; i < 100 && child.listenerCount('close') === 0; i++) {
    await new Promise<void>((resolve) => setImmediate(resolve))
  }
  if (child.listenerCount('close') === 0) {
    throw new Error('runGit did not attach a close listener within 100 I/O ticks')
  }
}

const withGitService = (fn: (ctx: { git: GitService; child: FakeChild }) => Promise<void>) =>
  usingAsync(new Injector(), async (injector) => {
    useLogging(injector, VerboseConsoleLogger)
    const child = createFakeChild()
    spawnMock.mockReturnValueOnce(child as unknown as ReturnType<typeof childProcess.spawn>)
    const git = injector.get(GitService)
    await fn({ git, child })
  })

describe('GitService runner', () => {
  beforeEach(() => {
    spawnMock.mockReset()
    spawnSyncMock.mockReset()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  describe('non-interactive env', () => {
    it('forces GIT_TERMINAL_PROMPT=0 and removes inherited askpass programs', () =>
      withGitService(async ({ git, child }) => {
        const promise = git.fetch('/repo')
        await awaitListenersAttached(child)
        child.stdout.end()
        child.stderr.end()
        child.emit('close', 0, null)
        await promise

        expect(spawnMock).toHaveBeenCalledTimes(1)
        const [, , opts] = spawnMock.mock.calls[0]
        const { env } = opts as { env: NodeJS.ProcessEnv }
        expect(env.GIT_TERMINAL_PROMPT).toBe('0')
        expect(env.GIT_ASKPASS).toBeUndefined()
        expect(env.SSH_ASKPASS).toBeUndefined()
        expect(env.SSH_ASKPASS_REQUIRE).toBe('never')
        expect(env.GIT_SSH_COMMAND).toMatch(/BatchMode=yes/)
        expect(env.GIT_SSH_COMMAND).toMatch(/ConnectTimeout=15/)
      }))

    it('strips GIT_ASKPASS / SSH_ASKPASS even when the host process has them set', () =>
      withGitService(async ({ git, child }) => {
        const original = { GIT_ASKPASS: process.env.GIT_ASKPASS, SSH_ASKPASS: process.env.SSH_ASKPASS }
        process.env.GIT_ASKPASS = '/usr/bin/some-gui-helper'
        process.env.SSH_ASKPASS = '/usr/bin/another-gui-helper'
        try {
          const promise = git.fetch('/repo')
          await awaitListenersAttached(child)
          child.stdout.end()
          child.stderr.end()
          child.emit('close', 0, null)
          await promise

          const [, , opts] = spawnMock.mock.calls[0]
          const { env } = opts as { env: NodeJS.ProcessEnv }
          expect(env.GIT_ASKPASS).toBeUndefined()
          expect(env.SSH_ASKPASS).toBeUndefined()
        } finally {
          if (original.GIT_ASKPASS === undefined) delete process.env.GIT_ASKPASS
          else process.env.GIT_ASKPASS = original.GIT_ASKPASS
          if (original.SSH_ASKPASS === undefined) delete process.env.SSH_ASKPASS
          else process.env.SSH_ASKPASS = original.SSH_ASKPASS
        }
      }))

    it('spawns with stdin ignored and windowsHide enabled', () =>
      withGitService(async ({ git, child }) => {
        const promise = git.fetch('/repo')
        await awaitListenersAttached(child)
        child.stdout.end()
        child.stderr.end()
        child.emit('close', 0, null)
        await promise

        const [, , opts] = spawnMock.mock.calls[0]
        const typed = opts as { stdio: unknown; windowsHide: boolean }
        expect(typed.stdio).toEqual(['ignore', 'pipe', 'pipe'])
        expect(typed.windowsHide).toBe(true)
      }))
  })

  describe('timeout and process-group kill', () => {
    it('kills the process group and rejects with stderr context when the call times out', async () => {
      vi.useFakeTimers()
      const killSpy = vi.spyOn(process, 'kill').mockImplementation(() => true)

      try {
        await usingAsync(new Injector(), async (injector) => {
          useLogging(injector, VerboseConsoleLogger)
          const child = createFakeChild(54321)
          spawnMock.mockReturnValueOnce(child as unknown as ReturnType<typeof childProcess.spawn>)

          const git = injector.get(GitService)
          const promise = git.fetch('/repo').then(
            () => ({ ok: true as const }),
            (error: Error) => ({ ok: false as const, error }),
          )

          child.stderr.write('fatal: unable to access remote\n')
          await vi.advanceTimersByTimeAsync(90 * 1000)

          if (process.platform === 'win32') {
            expect(spawnSyncMock).toHaveBeenCalledWith(
              'taskkill',
              ['/pid', '54321', '/T'],
              expect.objectContaining({ stdio: 'ignore' }),
            )
          } else {
            expect(killSpy).toHaveBeenCalledWith(-54321, 'SIGTERM')
          }

          await vi.advanceTimersByTimeAsync(2000)

          if (process.platform === 'win32') {
            expect(spawnSyncMock).toHaveBeenCalledWith(
              'taskkill',
              ['/pid', '54321', '/T', '/F'],
              expect.objectContaining({ stdio: 'ignore' }),
            )
          } else {
            expect(killSpy).toHaveBeenCalledWith(-54321, 'SIGKILL')
          }

          child.emit('close', null, 'SIGKILL')
          const result = await promise
          expect(result.ok).toBe(false)
          if (!result.ok) {
            expect(result.error.message).toMatch(/timed out after 90000ms/)
            expect(result.error.message).toContain('fatal: unable to access remote')
            expect(result.error.message).toContain('/repo')
          }
        })
      } finally {
        killSpy.mockRestore()
      }
    })

    it('does not kill or reject before the timeout fires', async () => {
      vi.useFakeTimers()
      const killSpy = vi.spyOn(process, 'kill').mockImplementation(() => true)

      try {
        await usingAsync(new Injector(), async (injector) => {
          useLogging(injector, VerboseConsoleLogger)
          const child = createFakeChild(99)
          spawnMock.mockReturnValueOnce(child as unknown as ReturnType<typeof childProcess.spawn>)

          const git = injector.get(GitService)
          const promise = git.fetch('/repo')

          await vi.advanceTimersByTimeAsync(89 * 1000)
          expect(killSpy).not.toHaveBeenCalled()
          expect(spawnSyncMock).not.toHaveBeenCalled()

          child.stdout.end()
          child.stderr.end()
          child.emit('close', 0, null)
          await expect(promise).resolves.toBeUndefined()
        })
      } finally {
        killSpy.mockRestore()
      }
    })
  })

  describe('error reporting', () => {
    it('includes stderr, exit code, and cwd when git exits non-zero', () =>
      withGitService(async ({ git, child }) => {
        const promise = git.checkout('/repo', 'develop').catch((error: Error) => error)
        await awaitListenersAttached(child)
        child.stderr.write('error: pathspec "develop" did not match\n')
        child.stdout.end()
        child.stderr.end()
        child.emit('close', 1, null)
        const error = await promise
        expect(error).toBeInstanceOf(Error)
        const { message } = error as Error
        expect(message).toMatch(/exited with code 1/)
        expect(message).toContain('/repo')
        expect(message).toContain('error: pathspec "develop" did not match')
      }))
  })
})
