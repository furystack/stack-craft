import { Injector } from '@furystack/inject'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { SystemApiClient } from './api-clients/system-api-client.js'
import { EnvironmentVariableService } from './environment-variable-service.js'

const createMocks = () => ({
  systemApi: { call: vi.fn() },
})

describe('EnvironmentVariableService', () => {
  let service: EnvironmentVariableService
  let mocks: ReturnType<typeof createMocks>

  beforeEach(() => {
    mocks = createMocks()
    const injector = new Injector()
    injector.setExplicitInstance(mocks.systemApi, SystemApiClient)
    service = injector.getInstance(EnvironmentVariableService)
  })

  describe('checkAvailability', () => {
    it('should return an empty record when no variable names provided', async () => {
      const result = await service.checkAvailability([])
      expect(result).toEqual({})
      expect(mocks.systemApi.call).not.toHaveBeenCalled()
    })

    it('should call the system API and return availability map', async () => {
      mocks.systemApi.call.mockResolvedValue({
        result: { DATABASE_URL: true, SECRET_KEY: false },
      })

      const result = await service.checkAvailability(['DATABASE_URL', 'SECRET_KEY'])

      expect(mocks.systemApi.call).toHaveBeenCalledWith({
        method: 'POST',
        action: '/system/check-env-availability',
        body: { variableNames: ['DATABASE_URL', 'SECRET_KEY'] },
      })
      expect(result).toEqual({ DATABASE_URL: true, SECRET_KEY: false })
    })

    it('should propagate API errors', async () => {
      mocks.systemApi.call.mockRejectedValue(new Error('Network error'))
      await expect(service.checkAvailability(['FOO'])).rejects.toThrow('Network error')
    })
  })

  describe('buildSavePayload', () => {
    it('should pass through non-sensitive values unchanged', () => {
      const editState = {
        API_URL: { source: 'custom' as const, customValue: 'http://localhost' },
      }
      const result = service.buildSavePayload(editState, new Set())
      expect(result).toEqual({
        API_URL: { source: 'custom', customValue: 'http://localhost' },
      })
    })

    it('should pass through inherit-source values unchanged', () => {
      const editState = {
        PATH: { source: 'inherit' as const, isSensitive: true },
      }
      const result = service.buildSavePayload(editState, new Set())
      expect(result).toEqual({
        PATH: { source: 'inherit', isSensitive: true },
      })
    })

    it('should replace untouched sensitive custom values with __UNCHANGED__', () => {
      const editState = {
        SECRET: { source: 'custom' as const, customValue: 'original-value', isSensitive: true },
      }
      const result = service.buildSavePayload(editState, new Set())
      expect(result.SECRET.customValue).toBe('__UNCHANGED__')
    })

    it('should keep touched sensitive custom values as-is', () => {
      const editState = {
        SECRET: { source: 'custom' as const, customValue: 'new-value', isSensitive: true },
      }
      const result = service.buildSavePayload(editState, new Set(['SECRET']))
      expect(result.SECRET.customValue).toBe('new-value')
    })

    it('should handle mixed entries correctly', () => {
      const editState = {
        PUBLIC_VAR: { source: 'custom' as const, customValue: 'public' },
        UNTOUCHED_SECRET: { source: 'custom' as const, customValue: 'masked', isSensitive: true },
        TOUCHED_SECRET: { source: 'custom' as const, customValue: 'updated', isSensitive: true },
        INHERITED: { source: 'inherit' as const },
      }
      const result = service.buildSavePayload(editState, new Set(['TOUCHED_SECRET']))

      expect(result.PUBLIC_VAR.customValue).toBe('public')
      expect(result.UNTOUCHED_SECRET.customValue).toBe('__UNCHANGED__')
      expect(result.TOUCHED_SECRET.customValue).toBe('updated')
      expect(result.INHERITED.source).toBe('inherit')
    })

    it('should return an empty record for empty input', () => {
      const result = service.buildSavePayload({}, new Set())
      expect(result).toEqual({})
    })
  })
})
