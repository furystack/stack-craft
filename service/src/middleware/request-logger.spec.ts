import { EventEmitter } from 'events'
import type { IncomingMessage, ServerResponse } from 'http'
import { Injector } from '@furystack/inject'
import { getLogger, useLogging, VerboseConsoleLogger } from '@furystack/logging'
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

  it('should call next() immediately', () =>
    usingAsync(new Injector(), async (injector) => {
      useLogging(injector, VerboseConsoleLogger)
      const middleware = useRequestLogger(injector)
      const req = createMockReq({ method: 'GET', url: '/test' })
      const res = createMockRes()
      const next = vi.fn()

      middleware(req, res, next)

      expect(next).toHaveBeenCalledOnce()
    }))

  it('should log at verbose level for 2xx status codes', () =>
    usingAsync(new Injector(), async (injector) => {
      useLogging(injector, VerboseConsoleLogger)
      const loggerCollection = getLogger(injector)
      const verboseSpy = vi.spyOn(loggerCollection, 'verbose')
      const middleware = useRequestLogger(injector)
      const req = createMockReq({ method: 'GET', url: '/api/health' })
      const res = createMockRes(200)

      middleware(req, res, vi.fn())
      res.emit('finish')

      await vi.waitFor(() => {
        expect(verboseSpy).toHaveBeenCalledOnce()
      })
    }))

  it('should log at warning level for 4xx status codes', () =>
    usingAsync(new Injector(), async (injector) => {
      useLogging(injector, VerboseConsoleLogger)
      const loggerCollection = getLogger(injector)
      const warningSpy = vi.spyOn(loggerCollection, 'warning')
      const middleware = useRequestLogger(injector)
      const req = createMockReq({ method: 'POST', url: '/api/login' })
      const res = createMockRes(404)

      middleware(req, res, vi.fn())
      res.emit('finish')

      await vi.waitFor(() => {
        expect(warningSpy).toHaveBeenCalledOnce()
      })
    }))

  it('should log at error level for 5xx status codes', () =>
    usingAsync(new Injector(), async (injector) => {
      useLogging(injector, VerboseConsoleLogger)
      const loggerCollection = getLogger(injector)
      const errorSpy = vi.spyOn(loggerCollection, 'error')
      const middleware = useRequestLogger(injector)
      const req = createMockReq({ method: 'GET', url: '/api/data' })
      const res = createMockRes(500)

      middleware(req, res, vi.fn())
      res.emit('finish')

      await vi.waitFor(() => {
        expect(errorSpy).toHaveBeenCalledOnce()
      })
    }))

  it('should use UNKNOWN for missing req.method', () =>
    usingAsync(new Injector(), async (injector) => {
      useLogging(injector, VerboseConsoleLogger)
      const loggerCollection = getLogger(injector)
      const verboseSpy = vi.spyOn(loggerCollection, 'verbose')
      const middleware = useRequestLogger(injector)
      const req = createMockReq({ url: '/test' })
      const res = createMockRes(200)

      middleware(req, res, vi.fn())
      res.emit('finish')

      await vi.waitFor(() => {
        expect(verboseSpy).toHaveBeenCalledOnce()
        expect(verboseSpy.mock.calls[0][0]).toMatchObject({
          scope: 'http',
          message: expect.stringContaining('UNKNOWN'),
          data: expect.objectContaining({ method: 'UNKNOWN' }),
        })
      })
    }))

  it('should use / for missing req.url', () =>
    usingAsync(new Injector(), async (injector) => {
      useLogging(injector, VerboseConsoleLogger)
      const loggerCollection = getLogger(injector)
      const verboseSpy = vi.spyOn(loggerCollection, 'verbose')
      const middleware = useRequestLogger(injector)
      const req = createMockReq({ method: 'GET' })
      const res = createMockRes(200)

      middleware(req, res, vi.fn())
      res.emit('finish')

      await vi.waitFor(() => {
        expect(verboseSpy).toHaveBeenCalledOnce()
        expect(verboseSpy.mock.calls[0][0]).toMatchObject({
          scope: 'http',
          message: expect.stringContaining('GET /'),
          data: expect.objectContaining({ url: '/' }),
        })
      })
    }))

  it('should include method, url, statusCode and duration in the log message', () =>
    usingAsync(new Injector(), async (injector) => {
      useLogging(injector, VerboseConsoleLogger)
      const loggerCollection = getLogger(injector)
      const verboseSpy = vi.spyOn(loggerCollection, 'verbose')
      const middleware = useRequestLogger(injector)
      const req = createMockReq({ method: 'PUT', url: '/api/users/1' })
      const res = createMockRes(201)

      middleware(req, res, vi.fn())
      res.emit('finish')

      await vi.waitFor(() => {
        expect(verboseSpy).toHaveBeenCalledOnce()
        const call = verboseSpy.mock.calls[0][0]
        expect(call.message).toMatch(/^PUT \/api\/users\/1 201 \d+ms$/)
        expect(call.data).toMatchObject({
          method: 'PUT',
          url: '/api/users/1',
          statusCode: 201,
          duration: expect.any(Number),
        })
      })
    }))
})
