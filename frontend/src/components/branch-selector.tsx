import { createComponent, Shade } from '@furystack/shades'
import { Button, Chip, cssVariableTheme, Icon, icons, NotyService } from '@furystack/shades-common-components'

import { ServicesApiClient } from '../services/api-clients/services-api-client.js'

type BranchSelectorProps = {
  serviceId: string
  currentBranch?: string
  isCloned: boolean
}

export const BranchSelector = Shade<BranchSelectorProps>({
  customElementName: 'shade-branch-selector',
  render: ({ props, injector, useState }) => {
    const { serviceId, currentBranch, isCloned } = props

    const [isOpen, setIsOpen] = useState('isOpen', false)
    const [branches, setBranches] = useState<{ local: string[]; remote: string[] } | null>('branches', null)
    const [isLoading, setIsLoading] = useState('isLoading', false)
    const [filter, setFilter] = useState('filter', '')
    const [isCheckingOut, setIsCheckingOut] = useState('isCheckingOut', false)

    const api = injector.getInstance(ServicesApiClient)
    const noty = injector.getInstance(NotyService)

    if (!isCloned) {
      return (
        <Chip variant="outlined" size="small" color="secondary">
          Not cloned
        </Chip>
      )
    }

    const loadBranches = async () => {
      if (branches) return
      setIsLoading(true)
      try {
        const result = await api.call({
          method: 'GET',
          action: '/services/:id/branches',
          url: { id: serviceId },
        })
        setBranches({ local: result.result.local, remote: result.result.remote })
      } catch {
        noty.emit('onNotyAdded', {
          title: 'Error',
          body: 'Failed to load branches',
          type: 'error',
        })
      } finally {
        setIsLoading(false)
      }
    }

    const handleCheckout = async (branch: string) => {
      if (branch === currentBranch) return
      setIsCheckingOut(true)
      try {
        await api.call({
          method: 'POST',
          action: '/services/:id/checkout',
          url: { id: serviceId },
          body: { branch },
        })
        noty.emit('onNotyAdded', {
          title: 'Branch changed',
          body: `Switched to ${branch}`,
          type: 'success',
        })
        setIsOpen(false)
        setBranches(null)
      } catch (error) {
        noty.emit('onNotyAdded', {
          title: 'Checkout failed',
          body: error instanceof Error ? error.message : 'Failed to checkout branch',
          type: 'error',
        })
      } finally {
        setIsCheckingOut(false)
      }
    }

    const toggleDropdown = () => {
      const willOpen = !isOpen
      setIsOpen(willOpen)
      if (willOpen) {
        void loadBranches()
      }
    }

    const allBranches = branches
      ? [
          ...branches.local.map((b) => ({ name: b, type: 'local' as const })),
          ...branches.remote.filter((b) => !b.endsWith('/HEAD')).map((b) => ({ name: b, type: 'remote' as const })),
        ]
      : []

    const filteredBranches = filter
      ? allBranches.filter((b) => b.name.toLowerCase().includes(filter.toLowerCase()))
      : allBranches

    const branchLabel = currentBranch ?? 'Select branch...'

    return (
      <div style={{ position: 'relative', display: 'inline-block' }}>
        <Button
          variant="outlined"
          size="small"
          onclick={toggleDropdown}
          disabled={isCheckingOut}
          startIcon={<Icon icon={icons.code} size="small" />}
        >
          <span style={{ fontFamily: 'monospace' }}>{branchLabel}</span>
          <span style={{ marginLeft: '4px', fontSize: cssVariableTheme.typography.fontSize.xs }}>
            {isOpen ? '▲' : '▼'}
          </span>
        </Button>

        {isOpen ? (
          <div
            style={{
              position: 'absolute',
              top: '100%',
              left: '0',
              marginTop: '4px',
              minWidth: '280px',
              maxWidth: 'calc(100vw - 32px)',
              maxHeight: '320px',
              overflow: 'auto',
              backgroundColor: cssVariableTheme.background.paper,
              border: `1px solid ${cssVariableTheme.divider}`,
              borderRadius: cssVariableTheme.shape.borderRadius.md,
              boxShadow: cssVariableTheme.shadows.md,
              zIndex: '100',
            }}
          >
            <div style={{ padding: '8px', borderBottom: `1px solid ${cssVariableTheme.divider}` }}>
              <input
                type="text"
                placeholder="Filter branches..."
                value={filter}
                oninput={(ev) => setFilter((ev.target as HTMLInputElement).value)}
                style={{
                  width: '100%',
                  padding: '6px 10px',
                  border: `1px solid ${cssVariableTheme.divider}`,
                  borderRadius: cssVariableTheme.shape.borderRadius.sm,
                  backgroundColor: cssVariableTheme.background.default,
                  color: cssVariableTheme.text.primary,
                  fontSize: cssVariableTheme.typography.fontSize.sm,
                  outline: 'none',
                  boxSizing: 'border-box',
                  fontFamily: 'inherit',
                }}
              />
            </div>

            {isLoading ? (
              <div style={{ padding: '16px', textAlign: 'center', color: cssVariableTheme.text.secondary }}>
                Loading...
              </div>
            ) : filteredBranches.length === 0 ? (
              <div style={{ padding: '16px', textAlign: 'center', color: cssVariableTheme.text.secondary }}>
                {filter ? 'No matching branches' : 'No branches found'}
              </div>
            ) : (
              <div style={{ padding: '4px 0' }}>
                {filteredBranches.map((branch) => {
                  const isCurrent = branch.name === currentBranch
                  return (
                    <button
                      type="button"
                      disabled={isCheckingOut}
                      onclick={() => void handleCheckout(branch.name)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        width: '100%',
                        padding: '8px 12px',
                        border: 'none',
                        background: isCurrent ? cssVariableTheme.button.hover : 'transparent',
                        color: isCurrent ? cssVariableTheme.palette.primary.main : cssVariableTheme.text.primary,
                        cursor: isCurrent ? 'default' : 'pointer',
                        fontSize: cssVariableTheme.typography.fontSize.sm,
                        fontFamily: 'monospace',
                        textAlign: 'left',
                      }}
                    >
                      <span style={{ flex: '1', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {branch.name}
                      </span>
                      {branch.type === 'remote' ? (
                        <span
                          style={{
                            fontSize: cssVariableTheme.typography.fontSize.xs,
                            opacity: '0.5',
                            fontFamily: 'sans-serif',
                          }}
                        >
                          remote
                        </span>
                      ) : null}
                      {isCurrent ? <span style={{ fontSize: cssVariableTheme.typography.fontSize.sm }}>✓</span> : null}
                    </button>
                  )
                })}
              </div>
            )}
          </div>
        ) : null}

        {isOpen ? (
          <div
            style={{
              position: 'fixed',
              top: '0',
              left: '0',
              right: '0',
              bottom: '0',
              zIndex: '99',
            }}
            onclick={() => setIsOpen(false)}
          />
        ) : null}
      </div>
    )
  },
})
