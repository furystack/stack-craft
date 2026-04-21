import { createComponent, Shade } from '@furystack/shades'
import { Button, NotyService } from '@furystack/shades-common-components'
import type { ServiceView } from 'common'

import { ServicesApiClient } from '../services/api-clients/services-api-client.js'

type ServiceWarningsProps = {
  service: ServiceView
}

/**
 * Inline row-level warnings for services:
 *  - `upstream-gone`: the checked-out branch no longer exists on origin
 *  - `stale`: install/build are out of sync with the current working tree
 */
export const ServiceWarnings = Shade<ServiceWarningsProps>({
  customElementName: 'shade-service-warnings',
  render: ({ props, injector }) => {
    const { service } = props
    const api = injector.getInstance(ServicesApiClient)
    const noty = injector.getInstance(NotyService)

    const dismissed = service.warningsDismissed ?? {}
    const showUpstreamGone = service.upstreamStatus === 'gone' && !dismissed.upstreamGone
    const isStale = service.installStatus === 'stale' || service.buildStatus === 'stale'
    const showStale = isStale && !dismissed.stale

    if (!showUpstreamGone && !showStale) return <span />

    const callAction = (
      action: '/services/:id/update' | '/services/:id/delete-branch' | '/services/:id/dismiss-warning',
      body: Record<string, unknown> | undefined,
      successTitle: string,
      successBody: string,
      failureTitle: string,
    ) => {
      void api
        .call({
          method: 'POST',
          action,
          url: { id: service.id },
          ...(body ? { body: body as never } : {}),
        } as never)
        .then(() => {
          noty.emit('onNotyAdded', { title: successTitle, body: successBody, type: 'success' })
        })
        .catch((error: unknown) => {
          noty.emit('onNotyAdded', {
            title: failureTitle,
            body: error instanceof Error ? error.message : failureTitle,
            type: 'error',
          })
        })
    }

    return (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '4px',
          marginTop: '6px',
        }}
      >
        {showUpstreamGone ? (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '6px 10px',
              background: 'var(--shades-theme-palette-warning-background)',
              borderLeft: '3px solid var(--shades-theme-palette-warning-main)',
              borderRadius: 'var(--shades-theme-shape-borderRadius-sm)',
              fontSize: 'var(--shades-theme-typography-fontSize-sm)',
            }}
          >
            <span style={{ flex: '1' }}>
              Branch <strong>{service.currentBranch ?? 'unknown'}</strong> was removed from origin.
            </span>
            <Button
              variant="text"
              size="small"
              title="Delete the local branch and switch to the default branch"
              onclick={() =>
                callAction(
                  '/services/:id/delete-branch',
                  { branch: service.currentBranch ?? '', force: true },
                  'Branch deleted',
                  `Deleted local branch "${service.currentBranch ?? ''}"`,
                  'Delete branch failed',
                )
              }
            >
              Delete local
            </Button>
            <Button
              variant="text"
              size="small"
              title="Dismiss this warning until the service is restarted"
              onclick={() =>
                callAction(
                  '/services/:id/dismiss-warning',
                  { kind: 'upstream-gone' },
                  'Warning dismissed',
                  'Warning dismissed for this session',
                  'Dismiss failed',
                )
              }
            >
              Dismiss
            </Button>
          </div>
        ) : null}
        {showStale ? (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '6px 10px',
              background: 'var(--shades-theme-palette-warning-background)',
              borderLeft: '3px solid var(--shades-theme-palette-warning-main)',
              borderRadius: 'var(--shades-theme-shape-borderRadius-sm)',
              fontSize: 'var(--shades-theme-typography-fontSize-sm)',
            }}
          >
            <span style={{ flex: '1' }}>Install/build are stale after an external git change.</span>
            <Button
              variant="text"
              size="small"
              title="Run update pipeline (install + build + restart if running)"
              onclick={() =>
                callAction('/services/:id/update', undefined, 'Update started', 'Update started', 'Update failed')
              }
            >
              Rebuild
            </Button>
            <Button
              variant="text"
              size="small"
              title="Dismiss this warning until the service is restarted"
              onclick={() =>
                callAction(
                  '/services/:id/dismiss-warning',
                  { kind: 'stale' },
                  'Warning dismissed',
                  'Warning dismissed for this session',
                  'Dismiss failed',
                )
              }
            >
              Dismiss
            </Button>
          </div>
        ) : null}
      </div>
    )
  },
})
