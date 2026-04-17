import type { Injector } from '@furystack/inject'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { McpSessionManager } from './mcp-server.js'

const mockUserInjector = () => ({ [Symbol.asyncDispose]: vi.fn().mockResolvedValue(undefined) }) as unknown as Injector

describe('McpSessionManager', () => {
  let manager: McpSessionManager

  beforeEach(() => {
    vi.useFakeTimers()
    manager = new McpSessionManager()
  })

  afterEach(() => {
    manager[Symbol.dispose]()
    vi.useRealTimers()
  })

  it('should start with zero sessions', () => {
    expect(manager.size).toBe(0)
  })

  it('should register a transport and track it', () => {
    const transport = { close: vi.fn(), onclose: null } as never
    manager.register('session-1', transport, mockUserInjector())

    expect(manager.size).toBe(1)
    expect(manager.get('session-1')).toBeDefined()
    expect(manager.get('session-1')?.transport).toBe(transport)
  })

  it('should update lastActivityAt on registration', () => {
    const now = Date.now()
    vi.setSystemTime(now)

    const transport = { close: vi.fn(), onclose: null } as never
    manager.register('session-1', transport, mockUserInjector())

    expect(manager.get('session-1')?.lastActivityAt).toBe(now)
  })

  it('should remove transport and dispose userInjector on close callback', () => {
    const callbacks: { onclose: (() => void) | null } = { onclose: null }
    const transport = {
      close: vi.fn(),
      set onclose(fn: (() => void) | null) {
        callbacks.onclose = fn
      },
      get onclose() {
        return callbacks.onclose
      },
    } as never

    const ui = mockUserInjector()
    manager.register('session-2', transport, ui)
    expect(manager.size).toBe(1)

    callbacks.onclose?.()
    expect(manager.size).toBe(0)
    expect(manager.get('session-2')).toBeUndefined()
    expect(ui[Symbol.asyncDispose]).toHaveBeenCalledOnce()
  })

  it('should return undefined for unknown session ids', () => {
    expect(manager.get('nonexistent')).toBeUndefined()
  })

  it('should sweep expired sessions and dispose their userInjectors', () => {
    const ui1 = mockUserInjector()
    const ui2 = mockUserInjector()
    const transport1 = { close: vi.fn(), onclose: null } as never
    const transport2 = { close: vi.fn(), onclose: null } as never

    manager.register('old-session', transport1, ui1)

    vi.advanceTimersByTime(31 * 60 * 1000)

    manager.register('new-session', transport2, ui2)

    vi.advanceTimersByTime(60_000)

    expect(manager.get('old-session')).toBeUndefined()
    expect(ui1[Symbol.asyncDispose]).toHaveBeenCalledOnce()
    expect(manager.get('new-session')).toBeDefined()
    expect(ui2[Symbol.asyncDispose]).not.toHaveBeenCalled()
    expect(manager.size).toBe(1)
  })

  it('should close all transports and dispose all userInjectors on dispose', () => {
    const close1 = vi.fn()
    const close2 = vi.fn()
    const ui1 = mockUserInjector()
    const ui2 = mockUserInjector()

    manager.register('s1', { close: close1, onclose: null } as never, ui1)
    manager.register('s2', { close: close2, onclose: null } as never, ui2)

    manager[Symbol.dispose]()

    expect(close1).toHaveBeenCalledOnce()
    expect(close2).toHaveBeenCalledOnce()
    expect(ui1[Symbol.asyncDispose]).toHaveBeenCalledOnce()
    expect(ui2[Symbol.asyncDispose]).toHaveBeenCalledOnce()
    expect(manager.size).toBe(0)
  })

  it('should track multiple sessions independently', () => {
    const t1 = { close: vi.fn(), onclose: null } as never
    const t2 = { close: vi.fn(), onclose: null } as never
    const t3 = { close: vi.fn(), onclose: null } as never

    manager.register('a', t1, mockUserInjector())
    manager.register('b', t2, mockUserInjector())
    manager.register('c', t3, mockUserInjector())

    expect(manager.size).toBe(3)
    expect(manager.get('a')?.transport).toBe(t1)
    expect(manager.get('b')?.transport).toBe(t2)
    expect(manager.get('c')?.transport).toBe(t3)
  })
})
