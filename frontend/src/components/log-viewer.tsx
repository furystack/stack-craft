import { createComponent, Shade } from '@furystack/shades'
import { Input } from '@furystack/shades-common-components'
import type { WebsocketMessage } from 'common'
import { WebSocketService } from '../services/websocket-service.js'
import { ServicesApiClient } from '../services/api-clients/services-api-client.js'

type LogViewerProps = {
  serviceId: string
}

export const LogViewer = Shade<LogViewerProps>({
  shadowDomName: 'shade-log-viewer',
  render: ({ props, injector, useState, useDisposable, useRef }) => {
    const [lines, setLines] = useState<string[]>('lines', [])
    const [filter, setFilter] = useState('filter', '')
    const [isLoaded, setIsLoaded] = useState('isLoaded', false)
    const containerRef = useRef<HTMLDivElement>('container')
    const linesRef = useDisposable('linesRef', () => ({
      current: lines,
      [Symbol.dispose]: () => {},
    }))
    linesRef.current = lines

    if (!isLoaded) {
      const api = injector.getInstance(ServicesApiClient)
      api
        .call({
          method: 'GET',
          action: '/services/:id/logs',
          url: { id: props.serviceId },
          query: { lines: 500 },
        })
        .then(({ result }) => {
          setLines(result.lines)
          setIsLoaded(true)
          requestAnimationFrame(() => {
            if (containerRef.current) {
              containerRef.current.scrollTop = containerRef.current.scrollHeight
            }
          })
        })
        .catch(() => setIsLoaded(true))
    }

    useDisposable('wsListener', () => {
      const ws = injector.getInstance(WebSocketService)
      ws.connect()
      return ws.addListener((msg: WebsocketMessage) => {
        if (msg.type === 'service-log' && msg.serviceId === props.serviceId) {
          setLines([...linesRef.current, msg.line])
          requestAnimationFrame(() => {
            if (containerRef.current) {
              const isNearBottom =
                containerRef.current.scrollHeight - containerRef.current.scrollTop - containerRef.current.clientHeight <
                100
              if (isNearBottom) {
                containerRef.current.scrollTop = containerRef.current.scrollHeight
              }
            }
          })
        }
      })
    })

    const filteredLines = filter ? lines.filter((l) => l.toLowerCase().includes(filter.toLowerCase())) : lines

    return (
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
        <div style={{ padding: '8px', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
          <Input
            variant="outlined"
            labelTitle="Search logs"
            value={filter}
            oninput={(ev) => setFilter((ev.target as HTMLInputElement).value)}
            style={{ width: '300px' }}
          />
        </div>
        <div
          ref={containerRef}
          style={{
            flex: '1',
            overflow: 'auto',
            padding: '8px 16px',
            fontFamily: "'Cascadia Code', 'Fira Code', 'Consolas', monospace",
            fontSize: '13px',
            lineHeight: '1.5',
            background: '#0d1117',
            color: '#c9d1d9',
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-all',
          }}
        >
          {filteredLines.length === 0 ? (
            <div style={{ opacity: '0.5', textAlign: 'center', padding: '32px' }}>
              {isLoaded ? 'No log output yet.' : 'Loading...'}
            </div>
          ) : null}
          {filteredLines.map((line) => (
            <div>{line}</div>
          ))}
        </div>
      </div>
    )
  },
})
