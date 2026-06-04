import { type ChildProcess, spawnSync } from 'node:child_process'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { killProcessTree } from './process-supervisor.js'

vi.mock('node:child_process', () => ({
  spawn: vi.fn(),
  spawnSync: vi.fn(),
}))

const withPlatform = (platform: NodeJS.Platform, fn: () => void) => {
  const original = process.platform
  Object.defineProperty(process, 'platform', { value: platform, writable: true })
  try {
    fn()
  } finally {
    Object.defineProperty(process, 'platform', { value: original, writable: true })
  }
}

describe('process-supervisor killProcessTree', () => {
  afterEach(() => {
    vi.clearAllMocks()
  })

  it('signals the supervisor process group with SIGTERM on POSIX (graceful)', () =>
    withPlatform('linux', () => {
      const killSpy = vi.spyOn(process, 'kill').mockImplementation(() => true)
      const child = { pid: 4321, kill: vi.fn() } as unknown as ChildProcess

      killProcessTree(child, false)

      expect(killSpy).toHaveBeenCalledWith(-process.pid, 'SIGTERM')
      killSpy.mockRestore()
    }))

  it('escalates to SIGKILL on POSIX when forced', () =>
    withPlatform('linux', () => {
      const killSpy = vi.spyOn(process, 'kill').mockImplementation(() => true)
      const child = { pid: 4321, kill: vi.fn() } as unknown as ChildProcess

      killProcessTree(child, true)

      expect(killSpy).toHaveBeenCalledWith(-process.pid, 'SIGKILL')
      killSpy.mockRestore()
    }))

  it('falls back to child.kill when the group signal throws on POSIX', () =>
    withPlatform('linux', () => {
      const killSpy = vi.spyOn(process, 'kill').mockImplementation(() => {
        throw new Error('ESRCH')
      })
      const childKill = vi.fn()
      const child = { pid: 4321, kill: childKill } as unknown as ChildProcess

      killProcessTree(child, false)

      expect(childKill).toHaveBeenCalledWith('SIGTERM')
      killSpy.mockRestore()
    }))

  it('uses taskkill /T without /F for graceful termination on Windows', () =>
    withPlatform('win32', () => {
      const child = { pid: 777, kill: vi.fn() } as unknown as ChildProcess

      killProcessTree(child, false)

      expect(spawnSync).toHaveBeenCalledWith('taskkill', ['/pid', '777', '/T'], { stdio: 'ignore' })
    }))

  it('uses taskkill /T /F when forced on Windows', () =>
    withPlatform('win32', () => {
      const child = { pid: 777, kill: vi.fn() } as unknown as ChildProcess

      killProcessTree(child, true)

      expect(spawnSync).toHaveBeenCalledWith('taskkill', ['/pid', '777', '/T', '/F'], { stdio: 'ignore' })
    }))

  it('does nothing on Windows when the child has no pid', () =>
    withPlatform('win32', () => {
      const child = { pid: undefined, kill: vi.fn() } as unknown as ChildProcess

      killProcessTree(child, false)

      expect(spawnSync).not.toHaveBeenCalled()
    }))
})
