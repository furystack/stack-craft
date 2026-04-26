import { createInjector, type Injector } from '@furystack/inject'
import { SequelizeClientFactory } from '@furystack/sequelize-store'
import { usingAsync } from '@furystack/utils'
import type { Sequelize } from 'sequelize'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { HealthCheckAction } from './health-check-action.js'

const callAction = (injector: Injector) => HealthCheckAction({ injector } as Parameters<typeof HealthCheckAction>[0])

const bindSequelizeFactory = (injector: Injector, sequelize: unknown): void => {
  injector.bind(SequelizeClientFactory, () => ({
    getSequelizeClient: () => sequelize as Sequelize,
  }))
}

describe('HealthCheckAction', () => {
  let originalDatabaseUrl: string | undefined

  beforeEach(() => {
    originalDatabaseUrl = process.env.DATABASE_URL
    process.env.DATABASE_URL = 'postgres://test:test@localhost:5432/testdb'
  })

  afterEach(() => {
    if (originalDatabaseUrl === undefined) {
      delete process.env.DATABASE_URL
    } else {
      process.env.DATABASE_URL = originalDatabaseUrl
    }
  })

  it('should return ok status when database is connected', async () => {
    const mockSequelize = { authenticate: vi.fn().mockResolvedValue(undefined) }
    await usingAsync(createInjector(), async (injector) => {
      bindSequelizeFactory(injector, mockSequelize)

      const result = await callAction(injector)

      const body = JSON.parse(JSON.stringify(result.chunk)) as { status: string; database: string; uptime: number }
      expect(body.status).toBe('ok')
      expect(body.database).toBe('connected')
      expect(body.uptime).toBeGreaterThanOrEqual(0)
    })
  })

  it('should return degraded status when database is disconnected', async () => {
    const mockSequelize = { authenticate: vi.fn().mockRejectedValue(new Error('conn refused')) }
    await usingAsync(createInjector(), async (injector) => {
      bindSequelizeFactory(injector, mockSequelize)

      const result = await callAction(injector)

      const body = JSON.parse(JSON.stringify(result.chunk)) as { status: string; database: string }
      expect(body.status).toBe('degraded')
      expect(body.database).toBe('disconnected')
    })
  })

  it('should return degraded when no sequelize factory is available', async () => {
    await usingAsync(createInjector(), async (injector) => {
      bindSequelizeFactory(injector, {
        authenticate: () => Promise.reject(new Error('no client')),
      })

      const result = await callAction(injector)

      const body = JSON.parse(JSON.stringify(result.chunk)) as { status: string; database: string }
      expect(body.status).toBe('degraded')
      expect(body.database).toBe('disconnected')
    })
  })
})
