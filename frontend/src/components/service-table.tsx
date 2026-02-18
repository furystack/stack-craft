import { createComponent, Shade } from '@furystack/shades'
import { Button, cssVariableTheme } from '@furystack/shades-common-components'
import type { Service } from 'common'
import { ServicesApiClient } from '../services/api-clients/services-api-client.js'
import { ServiceStatusIndicator } from './service-status-indicator.js'

type ServiceTableProps = {
  services: Service[]
  onRefresh: () => void
  onViewLogs: (serviceId: string) => void
  onEdit: (serviceId: string) => void
}

export const ServiceTable = Shade<ServiceTableProps>({
  shadowDomName: 'shade-service-table',
  css: {
    '& table': {
      width: '100%',
      borderCollapse: 'collapse',
    },
    '& th, & td': {
      textAlign: 'left',
      padding: '10px 12px',
      borderBottom: '1px solid rgba(255,255,255,0.08)',
    },
    '& th': {
      fontSize: '12px',
      textTransform: 'uppercase',
      letterSpacing: '0.5px',
      opacity: '0.7',
    },
    '& tr:hover td': {
      background: 'rgba(255,255,255,0.03)',
    },
  },
  render: ({ props, injector, useState }) => {
    const [selectedIds, setSelectedIds] = useState<Set<string>>('selected', new Set())
    const [loading, setLoading] = useState('loading', false)

    const api = injector.getInstance(ServicesApiClient)

    const toggleSelect = (id: string) => {
      const next = new Set(selectedIds)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      setSelectedIds(next)
    }

    const toggleAll = () => {
      if (selectedIds.size === props.services.length) {
        setSelectedIds(new Set())
      } else {
        setSelectedIds(new Set(props.services.map((s) => s.id)))
      }
    }

    const bulkAction = async (action: string) => {
      setLoading(true)
      for (const id of selectedIds) {
        try {
          await api.call({
            method: 'POST',
            action: `/services/:id/${action}` as '/services/:id/start',
            url: { id },
          })
        } catch {
          // Individual failures are handled by status updates
        }
      }
      setLoading(false)
      props.onRefresh()
    }

    const selectedServices = props.services.filter((s) => selectedIds.has(s.id))
    const hasRunning = selectedServices.some((s) => s.runStatus === 'running')
    const hasStopped = selectedServices.some((s) => s.runStatus !== 'running')

    return (
      <div>
        {selectedIds.size > 0 ? (
          <div
            style={{
              padding: '8px 16px',
              marginBottom: '8px',
              background: cssVariableTheme.background.paper,
              borderRadius: '8px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
            }}
          >
            <span style={{ fontSize: '14px', opacity: '0.8' }}>{selectedIds.size} selected</span>
            <div style={{ flex: '1' }} />
            {hasStopped ? (
              <Button
                variant="contained"
                color="success"
                disabled={loading}
                onclick={() => void bulkAction('start')}
              >
                Start
              </Button>
            ) : null}
            {hasRunning ? (
              <Button variant="outlined" disabled={loading} onclick={() => void bulkAction('stop')}>
                Stop
              </Button>
            ) : null}
            <Button variant="outlined" disabled={loading} onclick={() => void bulkAction('pull')}>
              Pull
            </Button>
            <Button variant="outlined" disabled={loading} onclick={() => void bulkAction('install')}>
              Reinstall
            </Button>
          </div>
        ) : null}
        <table>
          <thead>
            <tr>
              <th style={{ width: '40px' }}>
                <input
                  type="checkbox"
                  checked={selectedIds.size === props.services.length && props.services.length > 0}
                  onchange={toggleAll}
                />
              </th>
              <th>Service</th>
              <th>Status</th>
              <th style={{ width: '200px' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {props.services.length === 0 ? (
              <tr>
                <td colSpan={4} style={{ textAlign: 'center', padding: '32px', opacity: '0.5' }}>
                  No services in this stack yet.
                </td>
              </tr>
            ) : null}
            {props.services.map((svc) => (
              <tr>
                <td>
                  <input type="checkbox" checked={selectedIds.has(svc.id)} onchange={() => toggleSelect(svc.id)} />
                </td>
                <td>
                  <strong>{svc.displayName}</strong>
                  {svc.description ? (
                    <div style={{ fontSize: '12px', opacity: '0.6', marginTop: '2px' }}>{svc.description}</div>
                  ) : null}
                </td>
                <td>
                  <ServiceStatusIndicator service={svc} />
                </td>
                <td>
                  <div style={{ display: 'flex', gap: '4px' }}>
                    {svc.runStatus !== 'running' ? (
                      <Button
                        variant="outlined"
                        onclick={() => {
                          void api.call({ method: 'POST', action: '/services/:id/start', url: { id: svc.id } })
                          setTimeout(props.onRefresh, 500)
                        }}
                      >
                        Start
                      </Button>
                    ) : (
                      <Button
                        variant="outlined"
                        onclick={() => {
                          void api.call({ method: 'POST', action: '/services/:id/stop', url: { id: svc.id } })
                          setTimeout(props.onRefresh, 500)
                        }}
                      >
                        Stop
                      </Button>
                    )}
                    <Button variant="outlined" onclick={() => props.onViewLogs(svc.id)}>
                      Logs
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    )
  },
})
