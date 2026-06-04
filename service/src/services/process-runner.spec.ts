import { Injector } from '@furystack/inject'
import { useLogging, VerboseConsoleLogger } from '@furystack/logging'
import type { ChildProcess } from 'child_process'
import { describe, expect, it, vi } from 'vitest'

import { LogStorageService } from './log-storage-service.js'
import { ProcessRunner, ProcessRunnerImpl } from './process-runner.js'
import '../test-shims.js'

vi.mock('child_process', () => ({
  spawn: vi.fn(),
  spawnSync: vi.fn(),
}))

const setupRunnerInjector = (injector: Injector) => {
  useLogging(injector, VerboseConsoleLogger)

  const mockLogStorage = {
    addEntry: vi.fn().mockResolvedValue(undefined),
  }
  injector.setExplicitInstance(mockLogStorage as unknown as LogStorageService, LogStorageService)

  const runner = injector.get(ProcessRunner)
  return { runner, mockLogStorage }
}

const withRunnerContext = async (
  fn: (ctx: { runner: ProcessRunner; mockLogStorage: { addEntry: ReturnType<typeof vi.fn> } }) => Promise<void>,
) => {
  vi.useFakeTimers()
  const injector = new Injector()
  const { runner, mockLogStorage } = setupRunnerInjector(injector)
  try {
    await fn({ runner, mockLogStorage })
  } finally {
    await runner[Symbol.asyncDispose]()
    vi.useRealTimers()
    try {
      await injector[Symbol.asyncDispose]()
    } catch {
      // Singleton may already be disposed
    }
  }
}

describe('ProcessRunner', () => {
  describe('getSafeEnv', () => {
    it('should return only safe keys from process.env', () =>
      withRunnerContext(async () => {
        const original = process.env
        process.env = { PATH: '/usr/bin', HOME: '/home/test', SECRET_KEY: 'should-not-appear' }

        const env = ProcessRunnerImpl.getSafeEnv()

        expect(env.PATH).toBe('/usr/bin')
        expect(env.HOME).toBe('/home/test')
        expect(env).not.toHaveProperty('SECRET_KEY')

        process.env = original
      }))

    it('should include STACK_CRAFT_ prefixed keys', () =>
      withRunnerContext(async () => {
        const original = process.env
        process.env = { STACK_CRAFT_TOKEN: 'abc123', STACK_CRAFT_MODE: 'dev' }

        const env = ProcessRunnerImpl.getSafeEnv()

        expect(env.STACK_CRAFT_TOKEN).toBe('abc123')
        expect(env.STACK_CRAFT_MODE).toBe('dev')

        process.env = original
      }))

    it('should exclude secret/sensitive keys', () =>
      withRunnerContext(async () => {
        const original = process.env
        process.env = {
          PATH: '/usr/bin',
          AWS_SECRET_ACCESS_KEY: 'secret',
          DATABASE_URL: 'postgres://...',
          API_KEY: 'key123',
          GITHUB_TOKEN: 'ghp_xxx',
        }

        const env = ProcessRunnerImpl.getSafeEnv()

        expect(env.PATH).toBe('/usr/bin')
        expect(env).not.toHaveProperty('AWS_SECRET_ACCESS_KEY')
        expect(env).not.toHaveProperty('DATABASE_URL')
        expect(env).not.toHaveProperty('API_KEY')
        expect(env).not.toHaveProperty('GITHUB_TOKEN')

        process.env = original
      }))

    it('should forward WATCHDOG_GRACE_MS so supervisor overrides take effect', () =>
      withRunnerContext(async () => {
        const original = process.env
        process.env = { WATCHDOG_GRACE_MS: '250', SECRET_KEY: 'nope' }

        const env = ProcessRunnerImpl.getSafeEnv()

        expect(env.WATCHDOG_GRACE_MS).toBe('250')
        expect(env).not.toHaveProperty('SECRET_KEY')

        process.env = original
      }))

    it('should handle case-insensitive matching for safe keys', () =>
      withRunnerContext(async () => {
        const original = process.env
        process.env = { path: '/usr/bin', Path: '/usr/local/bin' }

        const env = ProcessRunnerImpl.getSafeEnv()

        expect(Object.keys(env).length).toBeGreaterThanOrEqual(1)

        process.env = original
      }))
  })

  describe('addLogLine', () => {
    it('should do nothing if service is not in the processes map', () =>
      withRunnerContext(async ({ runner, mockLogStorage }) => {
        runner.addLogLine('nonexistent', 'stdout', 'hello')

        expect(mockLogStorage.addEntry).not.toHaveBeenCalled()
      }))

    it('should buffer a line when the service exists in the processes map', () =>
      withRunnerContext(async ({ runner, mockLogStorage }) => {
        runner.processes.set('svc-1', {
          serviceId: 'svc-1',
          process: {} as ChildProcess,
          purpose: 'run',
          processUid: 'uid-1',
        })

        runner.addLogLine('svc-1', 'stdout', 'hello world')

        expect(mockLogStorage.addEntry).not.toHaveBeenCalled()
      }))

    it('should schedule a flush timer on first buffered line', () =>
      withRunnerContext(async ({ runner, mockLogStorage }) => {
        runner.processes.set('svc-1', {
          serviceId: 'svc-1',
          process: {} as ChildProcess,
          purpose: 'run',
          processUid: 'uid-1',
        })

        runner.addLogLine('svc-1', 'stdout', 'line 1')
        runner.addLogLine('svc-1', 'stderr', 'line 2')

        await vi.advanceTimersByTimeAsync(100)

        expect(mockLogStorage.addEntry).toHaveBeenCalledTimes(2)
        expect(mockLogStorage.addEntry).toHaveBeenCalledWith('svc-1', 'uid-1', 'stdout', 'line 1')
        expect(mockLogStorage.addEntry).toHaveBeenCalledWith('svc-1', 'uid-1', 'stderr', 'line 2')
      }))
  })

  describe('flushLogBuffer', () => {
    it('should flush buffered entries to logStorage', () =>
      withRunnerContext(async ({ runner, mockLogStorage }) => {
        runner.processes.set('svc-1', {
          serviceId: 'svc-1',
          process: {} as ChildProcess,
          purpose: 'run',
          processUid: 'uid-1',
        })

        runner.addLogLine('svc-1', 'stdout', 'line A')
        runner.addLogLine('svc-1', 'stderr', 'line B')

        await runner.flushLogBuffer()

        expect(mockLogStorage.addEntry).toHaveBeenCalledTimes(2)
        expect(mockLogStorage.addEntry).toHaveBeenCalledWith('svc-1', 'uid-1', 'stdout', 'line A')
        expect(mockLogStorage.addEntry).toHaveBeenCalledWith('svc-1', 'uid-1', 'stderr', 'line B')
      }))

    it('should be a no-op when buffer is empty', () =>
      withRunnerContext(async ({ runner, mockLogStorage }) => {
        await runner.flushLogBuffer()

        expect(mockLogStorage.addEntry).not.toHaveBeenCalled()
      }))
  })

  describe('killProcessGroup', () => {
    it('should return false when pid is null', () =>
      withRunnerContext(async ({ runner }) => {
        const child = { pid: undefined, kill: vi.fn() } as unknown as ChildProcess

        const result = runner.killProcessGroup(child, 'SIGTERM')

        expect(result).toBe(false)
        expect(child.kill).not.toHaveBeenCalled()
      }))

    it('should attempt group kill with process.kill on non-Windows', () =>
      withRunnerContext(async ({ runner }) => {
        const originalPlatform = process.platform
        Object.defineProperty(process, 'platform', { value: 'linux', writable: true })

        const killSpy = vi.spyOn(process, 'kill').mockImplementation(() => true)
        const child = { pid: 12345, kill: vi.fn() } as unknown as ChildProcess

        const result = runner.killProcessGroup(child, 'SIGTERM')

        expect(result).toBe(true)
        expect(killSpy).toHaveBeenCalledWith(-12345, 'SIGTERM')

        killSpy.mockRestore()
        Object.defineProperty(process, 'platform', { value: originalPlatform, writable: true })
      }))

    it('should fall back to child.kill when group kill throws', () =>
      withRunnerContext(async ({ runner }) => {
        const originalPlatform = process.platform
        Object.defineProperty(process, 'platform', { value: 'linux', writable: true })

        const killSpy = vi.spyOn(process, 'kill').mockImplementation(() => {
          throw new Error('ESRCH')
        })
        const child = { pid: 12345, kill: vi.fn().mockReturnValue(true) } as unknown as ChildProcess

        const result = runner.killProcessGroup(child, 'SIGTERM')

        expect(result).toBe(true)
        expect(child.kill).toHaveBeenCalledWith('SIGTERM')

        killSpy.mockRestore()
        Object.defineProperty(process, 'platform', { value: originalPlatform, writable: true })
      }))

    it('should return false when both group kill and child.kill fail', () =>
      withRunnerContext(async ({ runner }) => {
        const originalPlatform = process.platform
        Object.defineProperty(process, 'platform', { value: 'linux', writable: true })

        const killSpy = vi.spyOn(process, 'kill').mockImplementation(() => {
          throw new Error('ESRCH')
        })
        const child = {
          pid: 12345,
          kill: vi.fn().mockImplementation(() => {
            throw new Error('ESRCH')
          }),
        } as unknown as ChildProcess

        const result = runner.killProcessGroup(child, 'SIGTERM')

        expect(result).toBe(false)

        killSpy.mockRestore()
        Object.defineProperty(process, 'platform', { value: originalPlatform, writable: true })
      }))

    it('should use taskkill without /F on Windows for graceful signals', () =>
      withRunnerContext(async ({ runner }) => {
        const originalPlatform = process.platform
        Object.defineProperty(process, 'platform', { value: 'win32', writable: true })

        const { spawnSync } = await import('child_process')
        const child = { pid: 999, kill: vi.fn() } as unknown as ChildProcess

        const result = runner.killProcessGroup(child, 'SIGTERM')

        expect(result).toBe(true)
        expect(spawnSync).toHaveBeenCalledWith('taskkill', ['/pid', '999', '/T'], { stdio: 'ignore' })

        Object.defineProperty(process, 'platform', { value: originalPlatform, writable: true })
      }))

    it('should use taskkill with /F on Windows for SIGKILL', () =>
      withRunnerContext(async ({ runner }) => {
        const originalPlatform = process.platform
        Object.defineProperty(process, 'platform', { value: 'win32', writable: true })

        const { spawnSync } = await import('child_process')
        const child = { pid: 999, kill: vi.fn() } as unknown as ChildProcess

        const result = runner.killProcessGroup(child, 'SIGKILL')

        expect(result).toBe(true)
        expect(spawnSync).toHaveBeenCalledWith('taskkill', ['/pid', '999', '/T', '/F'], { stdio: 'ignore' })

        Object.defineProperty(process, 'platform', { value: originalPlatform, writable: true })
      }))
  })

  describe('[Symbol.asyncDispose]', () => {
    it('should clear flush timer and flush remaining log lines', () =>
      withRunnerContext(async ({ runner, mockLogStorage }) => {
        runner.processes.set('svc-1', {
          serviceId: 'svc-1',
          process: {} as ChildProcess,
          purpose: 'run',
          processUid: 'uid-1',
        })

        runner.addLogLine('svc-1', 'stdout', 'pending line')

        await runner[Symbol.asyncDispose]()

        expect(mockLogStorage.addEntry).toHaveBeenCalledWith('svc-1', 'uid-1', 'stdout', 'pending line')
      }))

    it('should be safe to call when no timer is active', () =>
      withRunnerContext(async ({ runner }) => {
        await expect(runner[Symbol.asyncDispose]()).resolves.toBeUndefined()
      }))
  })

  describe('spawnCommand', () => {
    it('should wrap the user command in the node supervisor on POSIX', () =>
      withRunnerContext(async ({ runner }) => {
        const originalPlatform = process.platform
        Object.defineProperty(process, 'platform', { value: 'linux', writable: true })

        const { spawn } = await import('child_process')
        vi.mocked(spawn).mockClear()
        const mockChild = { pid: 1, stdout: null, stderr: null } as unknown as ChildProcess
        vi.mocked(spawn).mockReturnValue(mockChild)

        const result = runner.spawnCommand('echo hello', '/tmp')

        expect(result).toBe(mockChild)
        expect(spawn).toHaveBeenCalledWith(
          process.execPath,
          ['-e', expect.stringContaining('spawn(shell, [shellFlag, command]'), '--', '/bin/sh', '-c', 'echo hello'],
          expect.objectContaining({
            cwd: '/tmp',
            stdio: ['pipe', 'pipe', 'pipe'],
            detached: true,
          }),
        )

        Object.defineProperty(process, 'platform', { value: originalPlatform, writable: true })
      }))

    it('should merge extraEnv into the environment', () =>
      withRunnerContext(async ({ runner }) => {
        const originalPlatform = process.platform
        Object.defineProperty(process, 'platform', { value: 'linux', writable: true })

        const { spawn } = await import('child_process')
        vi.mocked(spawn).mockClear()
        const mockChild = { pid: 1, stdout: null, stderr: null } as unknown as ChildProcess
        vi.mocked(spawn).mockReturnValue(mockChild)

        runner.spawnCommand('echo hello', '/tmp', { MY_VAR: 'test' })

        expect(spawn).toHaveBeenCalledWith(
          process.execPath,
          ['-e', expect.any(String), '--', '/bin/sh', '-c', 'echo hello'],
          expect.objectContaining({
            env: expect.objectContaining({ MY_VAR: 'test' }),
          }),
        )

        Object.defineProperty(process, 'platform', { value: originalPlatform, writable: true })
      }))

    it('should hand the supervisor cmd.exe on Windows', () =>
      withRunnerContext(async ({ runner }) => {
        const originalPlatform = process.platform
        Object.defineProperty(process, 'platform', { value: 'win32', writable: true })

        const { spawn } = await import('child_process')
        vi.mocked(spawn).mockClear()
        const mockChild = { pid: 1, stdout: null, stderr: null } as unknown as ChildProcess
        vi.mocked(spawn).mockReturnValue(mockChild)

        runner.spawnCommand('echo hello', 'C:\\temp')

        expect(spawn).toHaveBeenCalledWith(
          process.execPath,
          ['-e', expect.any(String), '--', 'cmd.exe', '/c', 'echo hello'],
          expect.objectContaining({ cwd: 'C:\\temp' }),
        )

        Object.defineProperty(process, 'platform', { value: originalPlatform, writable: true })
      }))
  })
})
