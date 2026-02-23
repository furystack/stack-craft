import { describe, expect, it } from 'vitest'

import { CheckEnvAvailabilityAction } from './check-env-availability-action.js'

const createMockActionContext = (body: { variableNames: string[] }) => ({
  injector: {} as never,
  getBody: () => Promise.resolve(body),
  getUrlParams: () => ({}) as never,
  getQuery: () => ({}) as never,
  request: {} as never,
  response: {} as never,
})

describe('CheckEnvAvailabilityAction', () => {
  it('should return true for env vars that exist', async () => {
    const originalPath = process.env.PATH
    try {
      process.env.PATH = '/usr/bin'
      const result = await CheckEnvAvailabilityAction(createMockActionContext({ variableNames: ['PATH'] }))
      expect(result.chunk.PATH).toBe(true)
    } finally {
      if (originalPath !== undefined) {
        process.env.PATH = originalPath
      }
    }
  })

  it('should return false for env vars that do not exist', async () => {
    delete process.env.DEFINITELY_NOT_SET_12345
    const result = await CheckEnvAvailabilityAction(
      createMockActionContext({ variableNames: ['DEFINITELY_NOT_SET_12345'] }),
    )
    expect(result.chunk.DEFINITELY_NOT_SET_12345).toBe(false)
  })

  it('should handle multiple variables', async () => {
    delete process.env.MISSING_VAR_A
    delete process.env.MISSING_VAR_B
    process.env.EXISTING_VAR_A = 'value'
    try {
      const result = await CheckEnvAvailabilityAction(
        createMockActionContext({ variableNames: ['EXISTING_VAR_A', 'MISSING_VAR_A', 'MISSING_VAR_B'] }),
      )
      expect(result.chunk.EXISTING_VAR_A).toBe(true)
      expect(result.chunk.MISSING_VAR_A).toBe(false)
      expect(result.chunk.MISSING_VAR_B).toBe(false)
    } finally {
      delete process.env.EXISTING_VAR_A
    }
  })

  it('should return empty object for empty input', async () => {
    const result = await CheckEnvAvailabilityAction(createMockActionContext({ variableNames: [] }))
    expect(result.chunk).toEqual({})
  })
})
