import { useCollectionSync } from '@furystack/entity-sync-client'
import { createComponent, Shade } from '@furystack/shades'
import { Input, Loader } from '@furystack/shades-common-components'
import { ServiceLogEntry } from 'common'

import { LogLine } from './log-line.js'

type LogViewerProps = {
  serviceId: string
  processUid?: string
}

export const LogViewer = Shade<LogViewerProps>({
  customElementName: 'shade-log-viewer',
  render: (options) => {
    const { props, useState, useRef } = options
    const [filter, setFilter] = useState('filter', '')
    const containerRef = useRef<HTMLDivElement>('container')

    const logsState = useCollectionSync(options, ServiceLogEntry, {
      filter: {
        serviceId: { $eq: props.serviceId },
        ...(props.processUid ? { processUid: { $eq: props.processUid } } : {}),
      },
      order: { id: 'DESC' },
      top: 300,
    })

    const isLoading = logsState.status === 'connecting'
    const entries =
      logsState.status === 'synced' || logsState.status === 'cached' ? [...logsState.data.entries].reverse() : []

    const filteredEntries = filter
      ? entries.filter((e) => e.line.toLowerCase().includes(filter.toLowerCase()))
      : entries

    if (isLoading) {
      return (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '32px' }}>
          <Loader />
        </div>
      )
    }

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
          {filteredEntries.length === 0 ? (
            <div style={{ opacity: '0.5', textAlign: 'center', padding: '32px' }}>No log output yet.</div>
          ) : null}
          {filteredEntries.map((entry) => (
            <div style={{ color: entry.stream === 'stderr' ? '#f85149' : '#c9d1d9' }}>
              <LogLine line={entry.line} />
            </div>
          ))}
        </div>
      </div>
    )
  },
})
