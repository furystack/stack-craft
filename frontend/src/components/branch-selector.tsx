import { createComponent, Shade } from '@furystack/shades'
import { Chip, NotyService } from '@furystack/shades-common-components'
import type { CloneStatus, UpstreamStatus } from 'common'

import { ServicesApiClient } from '../services/api-clients/services-api-client.js'

type BranchSelectorProps = {
  serviceId: string
  currentBranch?: string
  cloneStatus: CloneStatus
  upstreamStatus?: UpstreamStatus
  lastPullError?: string
}

/**
 * Builds the dropdown DOM on document.body so it never affects table/scroll layout.
 * Returns a cleanup function that removes all created elements.
 */
const showBranchDropdown = (opts: {
  anchor: HTMLElement
  branches: { local: string[]; remote: string[] }
  currentBranch: string | undefined
  onSelect: (branch: string) => void
}): Disposable => {
  const backdrop = document.createElement('div')
  Object.assign(backdrop.style, {
    position: 'fixed',
    inset: '0',
    zIndex: '9999',
  })

  const dropdown = document.createElement('div')
  Object.assign(dropdown.style, {
    position: 'fixed',
    zIndex: '10000',
    width: '260px',
    maxHeight: '280px',
    display: 'flex',
    flexDirection: 'column',
    background: 'var(--shades-theme-background-paper)',
    border: '1px solid var(--shades-theme-action-subtleBorder)',
    borderRadius: 'var(--shades-theme-shape-borderRadius-md)',
    boxShadow: 'var(--shades-theme-shadows-lg)',
    overflow: 'hidden',
    fontFamily: 'inherit',
  })

  const rect = opts.anchor.getBoundingClientRect()
  const spaceBelow = window.innerHeight - rect.bottom
  const top = spaceBelow >= 280 ? rect.bottom + 4 : rect.top - 280 - 4
  dropdown.style.top = `${Math.max(4, top)}px`
  dropdown.style.left = `${rect.left}px`

  const searchInput = document.createElement('input')
  Object.assign(searchInput.style, {
    padding: '8px 10px',
    border: 'none',
    borderBottom: '1px solid var(--shades-theme-action-subtleBorder)',
    background: 'transparent',
    color: 'var(--shades-theme-text-primary)',
    fontSize: 'var(--shades-theme-typography-fontSize-sm)',
    fontFamily: 'inherit',
    outline: 'none',
    boxSizing: 'border-box',
  })
  searchInput.type = 'text'
  searchInput.placeholder = 'Filter branches...'

  const listContainer = document.createElement('div')
  Object.assign(listContainer.style, { overflowY: 'auto', flex: '1' })

  // Close on scroll (capture phase catches scrolls in any ancestor) or viewport resize.
  // Repositioning is avoided because the anchor can disappear from the viewport mid-scroll.
  const closeOnViewportChange = () => cleanup()

  const cleanup = () => {
    window.removeEventListener('scroll', closeOnViewportChange, true)
    window.removeEventListener('resize', closeOnViewportChange)
    backdrop.remove()
    dropdown.remove()
  }

  const createItem = (branch: string) => {
    const btn = document.createElement('button')
    btn.type = 'button'
    btn.textContent = branch
    Object.assign(btn.style, {
      display: 'block',
      width: '100%',
      padding: '5px 10px',
      border: 'none',
      background: 'transparent',
      color:
        branch === opts.currentBranch ? 'var(--shades-theme-palette-primary-main)' : 'var(--shades-theme-text-primary)',
      fontWeight: branch === opts.currentBranch ? '600' : 'normal',
      fontSize: 'var(--shades-theme-typography-fontSize-sm)',
      fontFamily: 'inherit',
      textAlign: 'left',
      cursor: 'pointer',
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      whiteSpace: 'nowrap',
      boxSizing: 'border-box',
    })
    btn.addEventListener('mouseenter', () => {
      btn.style.background = 'var(--shades-theme-action-hoverBackground)'
    })
    btn.addEventListener('mouseleave', () => {
      btn.style.background = 'transparent'
    })
    btn.addEventListener('click', () => {
      cleanup()
      opts.onSelect(branch)
    })
    return btn
  }

  const createGroupLabel = (text: string) => {
    const div = document.createElement('div')
    div.textContent = text
    Object.assign(div.style, {
      padding: '6px 10px 2px',
      fontSize: 'var(--shades-theme-typography-fontSize-xs)',
      fontWeight: '600',
      color: 'var(--shades-theme-text-secondary)',
      textTransform: 'uppercase',
      letterSpacing: '0.04em',
    })
    return div
  }

  const renderList = (filterText: string) => {
    listContainer.innerHTML = ''
    const lower = filterText.toLowerCase()
    const localFiltered = opts.branches.local.filter((b) => b.toLowerCase().includes(lower))
    const remoteFiltered = opts.branches.remote.filter((b) => !b.endsWith('/HEAD') && b.toLowerCase().includes(lower))

    if (localFiltered.length > 0) {
      listContainer.appendChild(createGroupLabel('Local'))
      for (const b of localFiltered) listContainer.appendChild(createItem(b))
    }
    if (remoteFiltered.length > 0) {
      listContainer.appendChild(createGroupLabel('Remote'))
      for (const b of remoteFiltered) listContainer.appendChild(createItem(b))
    }
    if (localFiltered.length === 0 && remoteFiltered.length === 0) {
      const empty = document.createElement('div')
      empty.textContent = 'No matching branches'
      Object.assign(empty.style, { padding: '12px', textAlign: 'center', opacity: '0.5', fontSize: '13px' })
      listContainer.appendChild(empty)
    }
  }

  searchInput.addEventListener('input', () => renderList(searchInput.value))
  backdrop.addEventListener('click', cleanup)
  window.addEventListener('scroll', closeOnViewportChange, true)
  window.addEventListener('resize', closeOnViewportChange)

  dropdown.appendChild(searchInput)
  dropdown.appendChild(listContainer)
  document.body.appendChild(backdrop)
  document.body.appendChild(dropdown)

  renderList('')
  searchInput.focus()

  return { [Symbol.dispose]: cleanup }
}

export const BranchSelector = Shade<BranchSelectorProps>({
  customElementName: 'shade-branch-selector',
  css: {
    display: 'inline-block',

    '& .branch-trigger': {
      display: 'inline-flex',
      alignItems: 'center',
      gap: '4px',
      padding: '3px 10px',
      border: '1px solid var(--shades-theme-action-subtleBorder)',
      borderRadius: 'var(--shades-theme-shape-borderRadius-md)',
      background: 'transparent',
      color: 'var(--shades-theme-text-primary)',
      fontSize: 'var(--shades-theme-typography-fontSize-sm)',
      fontFamily: 'inherit',
      cursor: 'pointer',
      whiteSpace: 'nowrap',
      maxWidth: '180px',
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      transition: 'border-color 0.15s ease',
    },
    '& .branch-trigger:hover': {
      borderColor: 'var(--shades-theme-palette-primary-main)',
    },
    '& .branch-trigger[data-disabled]': {
      opacity: '0.5',
      cursor: 'wait',
    },
    '& .branch-trigger[data-upstream-gone]': {
      borderColor: 'var(--shades-theme-palette-warning-main)',
    },
    '& .branch-arrow': {
      fontSize: '8px',
      opacity: '0.5',
      flexShrink: '0',
    },
    '& .branch-spinner': {
      display: 'inline-block',
      width: '10px',
      height: '10px',
      borderRadius: '50%',
      border: '2px solid var(--shades-theme-action-subtleBorder)',
      borderTopColor: 'var(--shades-theme-palette-primary-main)',
      animation: 'shade-branch-spin 0.8s linear infinite',
      flexShrink: '0',
    },
  },
  render: ({ props, injector, useState, useDisposable, useRef }) => {
    const triggerRef = useRef<HTMLButtonElement>('triggerRef')
    const { serviceId, currentBranch, cloneStatus, upstreamStatus, lastPullError } = props

    const [branches, setBranches] = useState<{ local: string[]; remote: string[] } | null>('branches', null)
    const [isLoading, setIsLoading] = useState('isLoading', false)
    const [isCheckingOut, setIsCheckingOut] = useState('isCheckingOut', false)

    const api = injector.get(ServicesApiClient)
    const noty = injector.get(NotyService)

    const hasBranchInfo = Boolean(currentBranch)
    const isClonedOrPulling = cloneStatus === 'cloned' || (cloneStatus === 'cloning' && hasBranchInfo)
    const isInitialCloning = cloneStatus === 'cloning' && !hasBranchInfo

    const loadBranches = async () => {
      setIsLoading(true)
      try {
        const result = await api.call({
          method: 'GET',
          action: '/services/:id/branches',
          url: { id: serviceId },
        })
        setBranches({ local: result.result.local, remote: result.result.remote })
      } catch (error: unknown) {
        const reason = error instanceof Error ? error.message : 'Unknown error'
        noty.emit('onNotyAdded', { title: 'Failed to load branches', body: reason, type: 'error' })
      } finally {
        setIsLoading(false)
      }
    }

    useDisposable(
      `load-branches-${serviceId}-${currentBranch ?? ''}`,
      () => {
        if (isClonedOrPulling) void loadBranches()
        return { [Symbol.dispose]: () => {} }
      },
      [isClonedOrPulling, currentBranch],
    )

    if (isInitialCloning) {
      return (
        <Chip variant="outlined" size="small" color="primary">
          Cloning...
        </Chip>
      )
    }

    if (cloneStatus === 'failed') {
      return (
        <Chip variant="outlined" size="small" color="error" title={lastPullError ?? 'Clone failed. Retry via Update.'}>
          Clone failed
        </Chip>
      )
    }

    if (cloneStatus === 'not-cloned') {
      return (
        <Chip variant="outlined" size="small" color="secondary">
          Not cloned
        </Chip>
      )
    }

    const isPulling = cloneStatus === 'cloning'
    const isUpstreamGone = upstreamStatus === 'gone'

    const handleOpen = () => {
      if (!triggerRef.current || !branches) return

      showBranchDropdown({
        anchor: triggerRef.current,
        branches,
        currentBranch,
        onSelect: (branch) => {
          if (branch === currentBranch) return
          setIsCheckingOut(true)
          void api
            .call({
              method: 'POST',
              action: '/services/:id/checkout',
              url: { id: serviceId },
              body: { branch },
            })
            .then(() => {
              noty.emit('onNotyAdded', { title: 'Branch changed', body: `Switched to ${branch}`, type: 'success' })
              void loadBranches()
            })
            .catch((error: unknown) => {
              noty.emit('onNotyAdded', {
                title: 'Checkout failed',
                body: error instanceof Error ? error.message : 'Failed to checkout branch',
                type: 'error',
              })
            })
            .finally(() => setIsCheckingOut(false))
        },
      })
    }

    const disabled = isLoading || isCheckingOut || isPulling
    const label = isCheckingOut
      ? 'Switching...'
      : isPulling
        ? (currentBranch ?? 'Updating...')
        : (currentBranch ?? (isLoading ? 'Loading...' : 'No branch'))

    const title = isUpstreamGone
      ? `Branch "${currentBranch}" was removed from origin`
      : lastPullError
        ? `Last pull failed: ${lastPullError}`
        : (currentBranch ?? 'Select branch')

    return (
      <>
        <button
          ref={triggerRef}
          type="button"
          className="branch-trigger"
          onclick={handleOpen}
          disabled={disabled}
          title={title}
          {...(disabled ? { 'data-disabled': '' } : {})}
          {...(isUpstreamGone ? { 'data-upstream-gone': '' } : {})}
        >
          {isPulling || isCheckingOut ? <span className="branch-spinner" aria-hidden="true" /> : null}
          {label}
          <span className="branch-arrow">&#9660;</span>
        </button>
        <style>{`
          @keyframes shade-branch-spin {
            from { transform: rotate(0deg); }
            to { transform: rotate(360deg); }
          }
        `}</style>
      </>
    )
  },
})
