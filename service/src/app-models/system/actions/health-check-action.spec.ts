import { Injector } from '@furystack/inject'
import { usingAsync } from '@furystack/utils'
import { describe, expect, it, vi } from 'vitest'

import { HealthCheckAction } from './health-check-action.js'

const callAction = (injector: Injector) => HealthCheckAction({ injector } as Parameters<typeof HealthCheckAction>[0])

describe('HealthCheckAction', () => {
  it('should return ok status when database is connected', async () => {
    const mockSequelize = { authenticate: vi.fn().mockResolvedValue(undefined) }
    await usingAsync(new Injector(), async (injector) => {
      const { Sequelize } = await import('sequelize')
      injector.cachedSingletons.set(Sequelize, mockSequelize)

      const result = await callAction(injector)

      const body = JSON.parse(JSON.stringify(result.chunk)) as { status: string; database: string; uptime: number }
      expect(body.status).toBe('ok')
      expect(body.database).toBe('connected')
      expect(body.uptime).toBeGreaterThanOrEqual(0)
    })
  })

  it('should return degraded status when database is disconnected', async () => {
    const mockSequelize = { authenticate: vi.fn().mockRejectedValue(new Error('conn refused')) }
    await usingAsync(new Injector(), async (injector) => {
      const { Sequelize } = await import('sequelize')
      injector.cachedSingletons.set(Sequelize, mockSequelize)

      const result = await callAction(injector)

      const body = JSON.parse(JSON.stringify(result.chunk)) as { status: string; database: string }
      expect(body.status).toBe('degraded')
      expect(body.database).toBe('disconnected')
    })
  })

  it('should return degraded when no sequelize instance is cached', async () => {
    await usingAsync(new Injector(), async (injector) => {
      const result = await callAction(injector)

      const body = JSON.parse(JSON.stringify(result.chunk)) as { status: string; database: string }
      expect(body.status).toBe('degraded')
      expect(body.database).toBe('disconnected')
    })
  })
})
