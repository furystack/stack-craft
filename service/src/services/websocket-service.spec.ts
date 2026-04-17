import { SyncSubscribeAction, SyncUnsubscribeAction } from '@furystack/entity-sync-service'

import { beforeEach, describe, expect, it, vi } from 'vitest'

import { withTestInjector } from '../test-helpers.js'
import { WebsocketService } from './websocket-service.js'

const { mockUseWebsockets, mockGetHost, mockGetPort } = vi.hoisted(() => ({
  mockUseWebsockets: vi.fn().mockResolvedValue(undefined),
  mockGetHost: vi.fn(() => '127.0.0.1'),
  mockGetPort: vi.fn(() => 4242),
}))

vi.mock('@furystack/websocket-api', () => ({
  useWebsockets: mockUseWebsockets,
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
  it('init() calls useWebsockets with correct config (port, path, actions)', () =>
    withTestInjector(async ({ injector }) => {
      const ws = injector.getInstance(WebsocketService)
      await ws.init(injector)

      expect(mockGetHost).toHaveBeenCalled()
      expect(mockGetPort).toHaveBeenCalled()
      expect(mockUseWebsockets).toHaveBeenCalledWith(injector, {
        host: '127.0.0.1',
        port: 4242,
        path: '/api/ws',
        actions: [SyncSubscribeAction, SyncUnsubscribeAction],
      })
    }))

  it('is injectable as singleton', () =>
    withTestInjector(async ({ injector }) => {
      const a = injector.getInstance(WebsocketService)
      const b = injector.getInstance(WebsocketService)
      expect(a).toBe(b)
    }))
})
