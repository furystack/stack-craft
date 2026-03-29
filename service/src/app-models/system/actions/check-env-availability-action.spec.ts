import { Injector } from '@furystack/inject'
import { usingAsync } from '@furystack/utils'
import { describe, expect, it, vi } from 'vitest'

import { CheckEnvAvailabilityAction } from './check-env-availability-action.js'

const callAction = (injector: Injector, body: { variableNames: string[] }) =>
  CheckEnvAvailabilityAction({
    injector,
    getBody: vi.fn().mockResolvedValue(body),
  } as unknown as Parameters<typeof CheckEnvAvailabilityAction>[0])

describe('CheckEnvAvailabilityAction', () => {
  it('should return true for variables that exist in process.env', async () => {
    process.env.TEST_VAR_EXISTS = 'some-value'
    await usingAsync(new Injector(), async (injector) => {
      const result = await callAction(injector, { variableNames: ['TEST_VAR_EXISTS', 'TEST_VAR_MISSING'] })

      const body = JSON.parse(JSON.stringify(result.chunk)) as Record<string, boolean>
      expect(body.TEST_VAR_EXISTS).toBe(true)
      expect(body.TEST_VAR_MISSING).toBe(false)
    })
    delete process.env.TEST_VAR_EXISTS
  })

  it('should return false for all when no variables match', async () => {
    await usingAsync(new Injector(), async (injector) => {
      const result = await callAction(injector, { variableNames: ['DEFINITELY_NOT_SET_1', 'DEFINITELY_NOT_SET_2'] })

      const body = JSON.parse(JSON.stringify(result.chunk)) as Record<string, boolean>
      expect(body.DEFINITELY_NOT_SET_1).toBe(false)
      expect(body.DEFINITELY_NOT_SET_2).toBe(false)
    })
  })

  it('should handle an empty array', async () => {
    await usingAsync(new Injector(), async (injector) => {
      const result = await callAction(injector, { variableNames: [] })

      const body = JSON.parse(JSON.stringify(result.chunk)) as Record<string, boolean>
      expect(Object.keys(body)).toHaveLength(0)
    })
  })
})
