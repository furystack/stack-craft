import { EventEmitter } from 'events'
import type { IncomingMessage, ServerResponse } from 'http'
import { createInjector } from '@furystack/inject'
import { createLogger, useLogging, type LeveledLogEntry, type Logger } from '@furystack/logging'
import { usingAsync } from '@furystack/utils'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { useRequestLogger } from './request-logger.js'

describe('useRequestLogger', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  const createMockReq = (opts: { method?: string; url?: string } = {}) => {
    const req = new EventEmitter() as IncomingMessage
    if (opts.method !== undefined) req.method = opts.method
    if (opts.url !== undefined) req.url = opts.url
    return req
  }

  const createMockRes = (statusCode = 200) => {
    const res = new EventEmitter() as unknown as ServerResponse
    res.statusCode = statusCode
    return res
  }

  /** Spies on every leveled entry passed to the registered backend logger. */
  const setupSpyLogger = (): { logger: Logger; entries: Array<LeveledLogEntry<unknown>> } => {
    const entries: Array<LeveledLogEntry<unknown>> = []
    const logger = createLogger(async (entry) => {
      entries.push(entry)
    })
    return { logger, entries }
  }

  it('should call next() immediately', () =>
    usingAsync(createInjector(), async (injector) => {
      const { logger } = setupSpyLogger()
      useLogging(injector, logger)
      const middleware = useRequestLogger(injector)
      const req = createMockReq({ method: 'GET', url: '/test' })
      const res = createMockRes()
      const next = vi.fn()

      middleware(req, res, next)

      expect(next).toHaveBeenCalledOnce()
    }))

  it('should log at verbose level for 2xx status codes', () =>
    usingAsync(createInjector(), async (injector) => {
      const { logger, entries } = setupSpyLogger()
      useLogging(injector, logger)
      const middleware = useRequestLogger(injector)
      const res = createMockRes(200)
      middleware(createMockReq({ method: 'GET', url: '/api/health' }), res, vi.fn())
      res.emit('finish')
      await vi.waitFor(() => expect(entries).toHaveLength(1))
      expect(entries[0].level).toBe('verbose')
      expect(entries[0].scope).toBe('http')
    }))

  it('should log at warning level for 4xx status codes', () =>
    usingAsync(createInjector(), async (injector) => {
      const { logger, entries } = setupSpyLogger()
      useLogging(injector, logger)
      const middleware = useRequestLogger(injector)
      const res = createMockRes(404)
      middleware(createMockReq({ method: 'POST', url: '/api/login' }), res, vi.fn())
      res.emit('finish')
      await vi.waitFor(() => expect(entries).toHaveLength(1))
      expect(entries[0].level).toBe('warning')
    }))

  it('should log at error level for 5xx status codes', () =>
    usingAsync(createInjector(), async (injector) => {
      const { logger, entries } = setupSpyLogger()
      useLogging(injector, logger)
      const middleware = useRequestLogger(injector)
      const res = createMockRes(500)
      middleware(createMockReq({ method: 'GET', url: '/api/data' }), res, vi.fn())
      res.emit('finish')
      await vi.waitFor(() => expect(entries).toHaveLength(1))
      expect(entries[0].level).toBe('error')
    }))

  it('should use UNKNOWN for missing req.method', () =>
    usingAsync(createInjector(), async (injector) => {
      const { logger, entries } = setupSpyLogger()
      useLogging(injector, logger)
      const middleware = useRequestLogger(injector)
      const res = createMockRes(200)
      middleware(createMockReq({ url: '/test' }), res, vi.fn())
      res.emit('finish')
      await vi.waitFor(() => expect(entries).toHaveLength(1))
      const entry = entries[0] as LeveledLogEntry<{ method: string }>
      expect(entry.message).toContain('UNKNOWN')
      expect(entry.data?.method).toBe('UNKNOWN')
    }))

  it('should use / for missing req.url', () =>
    usingAsync(createInjector(), async (injector) => {
      const { logger, entries } = setupSpyLogger()
      useLogging(injector, logger)
      const middleware = useRequestLogger(injector)
      const res = createMockRes(200)
      middleware(createMockReq({ method: 'GET' }), res, vi.fn())
      res.emit('finish')
      await vi.waitFor(() => expect(entries).toHaveLength(1))
      const entry = entries[0] as LeveledLogEntry<{ url: string }>
      expect(entry.message).toContain('GET /')
      expect(entry.data?.url).toBe('/')
    }))

  it('should include method, url, statusCode and duration in the log message', () =>
    usingAsync(createInjector(), async (injector) => {
      const { logger, entries } = setupSpyLogger()
      useLogging(injector, logger)
      const middleware = useRequestLogger(injector)
      const res = createMockRes(201)
      middleware(createMockReq({ method: 'PUT', url: '/api/users/1' }), res, vi.fn())
      res.emit('finish')
      await vi.waitFor(() => expect(entries).toHaveLength(1))
      const entry = entries[0] as LeveledLogEntry<{
        method: string
        url: string
        statusCode: number
        duration: number
      }>
      expect(entry.message).toMatch(/^PUT \/api\/users\/1 201 \d+ms$/)
      expect(entry.data).toMatchObject({ method: 'PUT', url: '/api/users/1', statusCode: 201 })
    }))
})
