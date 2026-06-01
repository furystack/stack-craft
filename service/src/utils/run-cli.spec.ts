import { EventEmitter } from 'events'
import { PassThrough } from 'stream'
import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from 'vitest'

import { runCli } from './run-cli.js'

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

describe('runCli', () => {
  beforeEach(() => {
    spawnMock.mockReset()
    spawnSyncMock.mockReset()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  describe('env handling', () => {
    it('inherits process.env and applies overrides on top', async () => {
      const original = process.env.SOME_HOST_VAR
      process.env.SOME_HOST_VAR = 'host-value'
      try {
        const child = createFakeChild()
        spawnMock.mockReturnValueOnce(child as unknown as ReturnType<typeof childProcess.spawn>)

        const promise = runCli('git', ['--version'], {
          timeoutMs: 1000,
          env: { GIT_TERMINAL_PROMPT: '0' },
        })
        child.stdout.end()
        child.stderr.end()
        child.emit('close', 0, null)
        await promise

        const [, , opts] = spawnMock.mock.calls[0]
        const { env } = opts as { env: NodeJS.ProcessEnv }
        expect(env.SOME_HOST_VAR).toBe('host-value')
        expect(env.GIT_TERMINAL_PROMPT).toBe('0')
      } finally {
        if (original === undefined) delete process.env.SOME_HOST_VAR
        else process.env.SOME_HOST_VAR = original
      }
    })

    it('strips inherited env vars when override sets them to undefined', async () => {
      const original = process.env.GIT_ASKPASS
      process.env.GIT_ASKPASS = '/usr/bin/some-gui-helper'
      try {
        const child = createFakeChild()
        spawnMock.mockReturnValueOnce(child as unknown as ReturnType<typeof childProcess.spawn>)

        const promise = runCli('git', ['--version'], {
          timeoutMs: 1000,
          env: { GIT_ASKPASS: undefined },
        })
        child.stdout.end()
        child.stderr.end()
        child.emit('close', 0, null)
        await promise

        const [, , opts] = spawnMock.mock.calls[0]
        const { env } = opts as { env: NodeJS.ProcessEnv }
        expect(env.GIT_ASKPASS).toBeUndefined()
      } finally {
        if (original === undefined) delete process.env.GIT_ASKPASS
        else process.env.GIT_ASKPASS = original
      }
    })
  })

  describe('spawn options', () => {
    it('spawns with stdin ignored, stdout/stderr piped, and windowsHide enabled', async () => {
      const child = createFakeChild()
      spawnMock.mockReturnValueOnce(child as unknown as ReturnType<typeof childProcess.spawn>)

      const promise = runCli('node', ['--version'], { timeoutMs: 1000 })
      child.stdout.end()
      child.stderr.end()
      child.emit('close', 0, null)
      await promise

      expect(spawnMock).toHaveBeenCalledWith(
        'node',
        ['--version'],
        expect.objectContaining({
          stdio: ['ignore', 'pipe', 'pipe'],
          windowsHide: true,
        }),
      )
    })

    it('forwards cwd when provided', async () => {
      const child = createFakeChild()
      spawnMock.mockReturnValueOnce(child as unknown as ReturnType<typeof childProcess.spawn>)

      const promise = runCli('git', ['status'], { cwd: '/tmp/repo', timeoutMs: 1000 })
      child.stdout.end()
      child.stderr.end()
      child.emit('close', 0, null)
      await promise

      const [, , opts] = spawnMock.mock.calls[0]
      expect((opts as { cwd?: string }).cwd).toBe('/tmp/repo')
    })

    it('uses detached: true on POSIX so process-group kill is possible', async () => {
      if (process.platform === 'win32') return
      const child = createFakeChild()
      spawnMock.mockReturnValueOnce(child as unknown as ReturnType<typeof childProcess.spawn>)

      const promise = runCli('node', ['--version'], { timeoutMs: 1000 })
      child.stdout.end()
      child.stderr.end()
      child.emit('close', 0, null)
      await promise

      const [, , opts] = spawnMock.mock.calls[0]
      expect((opts as { detached: boolean }).detached).toBe(true)
    })
  })

  describe('successful invocation', () => {
    it('resolves with captured stdout and stderr on exit code 0', async () => {
      const child = createFakeChild()
      spawnMock.mockReturnValueOnce(child as unknown as ReturnType<typeof childProcess.spawn>)

      const promise = runCli('git', ['--version'], { timeoutMs: 1000 })
      child.stdout.write('git version 2.43.0\n')
      child.stderr.write('warning: something\n')
      child.stdout.end()
      child.stderr.end()
      child.emit('close', 0, null)

      const result = await promise
      expect(result.stdout).toBe('git version 2.43.0\n')
      expect(result.stderr).toBe('warning: something\n')
    })
  })

  describe('error reporting', () => {
    it('rejects with stderr, exit code, and command in message on non-zero exit', async () => {
      const child = createFakeChild()
      spawnMock.mockReturnValueOnce(child as unknown as ReturnType<typeof childProcess.spawn>)

      const promise = runCli('git', ['ls-remote', 'https://example.com/missing.git'], {
        timeoutMs: 1000,
      }).catch((error: Error) => error)
      child.stderr.write('fatal: repository not found\n')
      child.stdout.end()
      child.stderr.end()
      child.emit('close', 128, null)

      const error = await promise
      expect(error).toBeInstanceOf(Error)
      const { message } = error as Error
      expect(message).toContain('git ls-remote https://example.com/missing.git')
      expect(message).toMatch(/exited with code 128/)
      expect(message).toContain('fatal: repository not found')
    })

    it('rejects on `error` event from the child process', async () => {
      const child = createFakeChild()
      spawnMock.mockReturnValueOnce(child as unknown as ReturnType<typeof childProcess.spawn>)

      const promise = runCli('does-not-exist', [], { timeoutMs: 1000 }).catch((error: Error) => error)
      child.emit('error', new Error('ENOENT'))

      const error = await promise
      expect(error).toBeInstanceOf(Error)
      expect((error as Error).message).toBe('ENOENT')
    })
  })

  describe('timeout and process-group kill', () => {
    it('kills the process group on timeout and rejects with stderr context', async () => {
      vi.useFakeTimers()
      const killSpy = vi.spyOn(process, 'kill').mockImplementation(() => true)

      try {
        const child = createFakeChild(54321)
        spawnMock.mockReturnValueOnce(child as unknown as ReturnType<typeof childProcess.spawn>)

        const promise = runCli('curl', ['https://slow.example.com'], { timeoutMs: 5_000 }).then(
          () => ({ ok: true as const }),
          (error: Error) => ({ ok: false as const, error }),
        )

        child.stderr.write('curl: still trying\n')
        await vi.advanceTimersByTimeAsync(5_000)

        if (process.platform === 'win32') {
          expect(spawnSyncMock).toHaveBeenCalledWith(
            'taskkill',
            ['/pid', '54321', '/T'],
            expect.objectContaining({ stdio: 'ignore' }),
          )
        } else {
          expect(killSpy).toHaveBeenCalledWith(-54321, 'SIGTERM')
        }

        await vi.advanceTimersByTimeAsync(2_000)

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
          expect(result.error.message).toMatch(/timed out after 5000ms/)
          expect(result.error.message).toContain('curl: still trying')
        }
      } finally {
        killSpy.mockRestore()
      }
    })

    it('does not kill or reject before the timeout fires', async () => {
      vi.useFakeTimers()
      const killSpy = vi.spyOn(process, 'kill').mockImplementation(() => true)

      try {
        const child = createFakeChild(99)
        spawnMock.mockReturnValueOnce(child as unknown as ReturnType<typeof childProcess.spawn>)

        const promise = runCli('node', ['--version'], { timeoutMs: 5_000 })

        await vi.advanceTimersByTimeAsync(4_999)
        expect(killSpy).not.toHaveBeenCalled()
        expect(spawnSyncMock).not.toHaveBeenCalled()

        child.stdout.end()
        child.stderr.end()
        child.emit('close', 0, null)
        await expect(promise).resolves.toEqual({ stdout: '', stderr: '' })
      } finally {
        killSpy.mockRestore()
      }
    })
  })
})
