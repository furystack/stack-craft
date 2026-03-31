import type { Injector } from '@furystack/inject'
import { Injectable } from '@furystack/inject'
import { SyncSubscribeAction, SyncUnsubscribeAction } from '@furystack/entity-sync-service'
import { useWebsockets } from '@furystack/websocket-api'
import { getHost } from '../get-host.js'
import { getPort } from '../get-port.js'

/** Initializes the WebSocket server for real-time entity synchronization with connected clients */
@Injectable({ lifetime: 'singleton' })
export class WebsocketService {
  public async init(injector: Injector) {
    await useWebsockets(injector, {
      host: getHost(),
      port: getPort(),
      path: '/api/ws',
      actions: [SyncSubscribeAction, SyncUnsubscribeAction],
    })
  }
}
