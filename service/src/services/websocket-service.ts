import type { Injector } from '@furystack/inject'
import { Injectable } from '@furystack/inject'
import { SyncSubscribeAction, SyncUnsubscribeAction } from '@furystack/entity-sync-service'
import { useWebsockets } from '@furystack/websocket-api'
import { getPort } from '../get-port.js'

@Injectable({ lifetime: 'singleton' })
export class WebsocketService {
  public async init(injector: Injector) {
    await useWebsockets(injector, {
      port: getPort(),
      path: '/api/ws',
      actions: [SyncSubscribeAction, SyncUnsubscribeAction],
    })
  }
}
