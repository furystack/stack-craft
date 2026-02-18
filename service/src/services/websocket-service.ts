import type { Injector } from '@furystack/inject'
import { Injectable, Injected } from '@furystack/inject'
import { useWebsockets, WebSocketApi } from '@furystack/websocket-api'
import type { WebsocketMessage } from 'common'
import { getPort } from '../get-port.js'

@Injectable({ lifetime: 'singleton' })
export class WebsocketService {
  @Injected((injector) => {
    return injector.getInstance(WebSocketApi)
  })
  declare private webSocketApi: WebSocketApi

  public async init(injector: Injector) {
    await useWebsockets(injector, {
      port: getPort(),
      path: '/api/ws',
    })
  }

  public announce = async (message: WebsocketMessage) => {
    const data = JSON.stringify(message)
    await this.webSocketApi.broadcast(async (options) => {
      try {
        const ws = options.ws as unknown as { send: (data: string) => void }
        ws.send(data)
      } catch {
        // Client may have disconnected
      }
    })
  }
}
