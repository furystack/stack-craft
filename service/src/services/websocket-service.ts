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
    await this.webSocketApi.broadcast(async (options) => {
      try {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
        options.ws.send(JSON.stringify(message))
      } catch {
        // Client may have disconnected
      }
    })
  }
}
