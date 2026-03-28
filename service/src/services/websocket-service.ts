import type { Injector } from '@furystack/inject'
import { Injectable } from '@furystack/inject'
import { SyncSubscribeAction, SyncUnsubscribeAction } from '@furystack/entity-sync-service'
import { useWebsockets, WebSocketApi } from '@furystack/websocket-api'
import type { WebsocketMessage } from 'common'
import { getPort } from '../get-port.js'

@Injectable({ lifetime: 'singleton' })
export class WebsocketService {
  private webSocketApi: WebSocketApi | null = null

  public async init(injector: Injector) {
    await useWebsockets(injector, {
      port: getPort(),
      path: '/api/ws',
      actions: [SyncSubscribeAction, SyncUnsubscribeAction],
    })
    this.webSocketApi = injector.getInstance(WebSocketApi)
  }

  public announce = async (message: WebsocketMessage) => {
    if (!this.webSocketApi) return
    const data = JSON.stringify(message)
    await this.webSocketApi.broadcast(({ ws }: { ws: { send: (data: string) => void } }) => {
      ws.send(data)
    })
  }
}
