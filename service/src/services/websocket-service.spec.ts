import { SyncSubscribeAction, SyncUnsubscribeAction } from '@furystack/entity-sync-service'

import { beforeEach, describe, expect, it, vi } from 'vitest'

import { withTestInjector } from '../test-helpers.js'
import { WebsocketService } from './websocket-service.js'

const { mockUseWebSocketApi, mockGetHost, mockGetPort } = vi.hoisted(() => ({
  mockUseWebSocketApi: vi.fn().mockResolvedValue(undefined),
  mockGetHost: vi.fn(() => '127.0.0.1'),
  mockGetPort: vi.fn(() => 4242),
}))

vi.mock('@furystack/websocket-api', () => ({
  useWebSocketApi: mockUseWebSocketApi,
}))

vi.mock('../get-host.js', () => ({
  getHost: mockGetHost,
}))

vi.mock('../get-port.js', () => ({
  getPort: mockGetPort,
}))

beforeEach(() => {
  vi.clearAllMocks()
})

describe('WebsocketService', () => {
  it('init() calls useWebSocketApi with correct config (port, path, actions)', () =>
    withTestInjector(async ({ injector }) => {
      const ws = injector.get(WebsocketService)
      await ws.init(injector)

      expect(mockGetHost).toHaveBeenCalled()
      expect(mockGetPort).toHaveBeenCalled()
      expect(mockUseWebSocketApi).toHaveBeenCalledWith({
        injector,
        hostName: '127.0.0.1',
        port: 4242,
        path: '/api/ws',
        actions: [SyncSubscribeAction, SyncUnsubscribeAction],
      })
    }))

  it('is injectable as singleton', () =>
    withTestInjector(async ({ injector }) => {
      const a = injector.get(WebsocketService)
      const b = injector.get(WebsocketService)
      expect(a).toBe(b)
    }))
})
