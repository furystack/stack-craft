import { Injectable } from '@furystack/inject'
import { ObservableValue } from '@furystack/utils'
import type { WebsocketMessage } from 'common'

type WebSocketEventHandler = (message: WebsocketMessage) => void

@Injectable({ lifetime: 'singleton' })
export class WebSocketService {
  private ws: WebSocket | null = null
  private listeners = new Set<WebSocketEventHandler>()
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null

  public connectionState = new ObservableValue<'connecting' | 'connected' | 'disconnected'>('disconnected')

  public connect() {
    if (this.ws) return

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    const url = `${protocol}//${window.location.hostname}:9090/api/ws`

    this.connectionState.setValue('connecting')
    this.ws = new WebSocket(url)

    this.ws.onopen = () => {
      this.connectionState.setValue('connected')
    }

    this.ws.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data as string) as WebsocketMessage
        this.listeners.forEach((listener) => listener(message))
      } catch {
        // Ignore non-JSON messages
      }
    }

    this.ws.onclose = () => {
      this.ws = null
      this.connectionState.setValue('disconnected')
      this.scheduleReconnect()
    }

    this.ws.onerror = () => {
      this.ws?.close()
    }
  }

  public disconnect() {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer)
      this.reconnectTimer = null
    }
    this.ws?.close()
    this.ws = null
    this.connectionState.setValue('disconnected')
  }

  public addListener(handler: WebSocketEventHandler) {
    this.listeners.add(handler)
    return { [Symbol.dispose]: () => this.listeners.delete(handler) }
  }

  private scheduleReconnect() {
    if (this.reconnectTimer) return
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null
      this.connect()
    }, 3000)
  }
}
