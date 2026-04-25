import { defineService, type Injector, type Token } from '@furystack/inject'
import { SyncSubscribeAction, SyncUnsubscribeAction } from '@furystack/entity-sync-service'
import { useWebSocketApi } from '@furystack/websocket-api'

import { getHost } from '../get-host.js'
import { getPort } from '../get-port.js'

/** Initializes the WebSocket server for real-time entity synchronization with connected clients */
class WebsocketServiceImpl {
  public async init(injector: Injector) {
    await useWebSocketApi({
      injector,
      hostName: getHost(),
      port: getPort(),
      path: '/api/ws',
      actions: [SyncSubscribeAction, SyncUnsubscribeAction],
    })
  }
}

export type WebsocketService = WebsocketServiceImpl

export const WebsocketService: Token<WebsocketService, 'singleton'> = defineService({
  name: 'app/WebsocketService',
  lifetime: 'singleton',
  factory: () => new WebsocketServiceImpl(),
})
