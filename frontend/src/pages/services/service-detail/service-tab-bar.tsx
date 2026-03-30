import { createComponent, Shade } from '@furystack/shades'
import { cssVariableTheme } from '@furystack/shades-common-components'

import type { TabId } from './index.js'

/* ============================================
 * Tab Bar
 * ============================================ */

type ServiceTabBarProps = {
  tabs: Array<{ id: TabId; label: string }>
  activeTab: TabId
  onTabChange: (tab: TabId) => void
}

export const ServiceTabBar = Shade<ServiceTabBarProps>({
  customElementName: 'shade-service-tab-bar',
  css: {
    display: 'flex',
    gap: '0',
    borderBottom: `1px solid ${cssVariableTheme.divider}`,
    marginBottom: cssVariableTheme.spacing.md,

    '& button': {
      padding: `${cssVariableTheme.spacing.sm} ${cssVariableTheme.spacing.lg}`,
      cursor: 'pointer',
      border: 'none',
      borderBottom: '2px solid transparent',
      background: 'transparent',
      color: cssVariableTheme.text.secondary,
      fontWeight: cssVariableTheme.typography.fontWeight.normal,
      fontSize: cssVariableTheme.typography.fontSize.md,
      transition: `all ${cssVariableTheme.transitions.duration.normal} ${cssVariableTheme.transitions.easing.easeInOut}`,
      fontFamily: 'inherit',
    },
    '& button:hover': {
      color: cssVariableTheme.text.primary,
    },
    '& button[data-active]': {
      borderBottomColor: cssVariableTheme.palette.primary.main,
      color: cssVariableTheme.palette.primary.main,
      fontWeight: cssVariableTheme.typography.fontWeight.semibold,
    },
  },
  render: ({ props }) => {
    const handleKeyDown = (ev: KeyboardEvent) => {
      const currentIndex = props.tabs.findIndex((t) => t.id === props.activeTab)
      let nextIndex: number | undefined

      switch (ev.key) {
        case 'ArrowRight':
          nextIndex = (currentIndex + 1) % props.tabs.length
          break
        case 'ArrowLeft':
          nextIndex = (currentIndex - 1 + props.tabs.length) % props.tabs.length
          break
        case 'Home':
          nextIndex = 0
          break
        case 'End':
          nextIndex = props.tabs.length - 1
          break
        default:
          break
      }

      if (nextIndex !== undefined) {
        ev.preventDefault()
        props.onTabChange(props.tabs[nextIndex].id)
        const nextButton = (ev.currentTarget as HTMLElement).querySelector<HTMLElement>(
          `#tab-${props.tabs[nextIndex].id}`,
        )
        nextButton?.focus()
      }
    }

    return (
      <div data-testid="service-detail-tabs" role="tablist" onkeydown={handleKeyDown}>
        {props.tabs.map((tab) => {
          const isActive = props.activeTab === tab.id
          return (
            <button
              type="button"
              role="tab"
              id={`tab-${tab.id}`}
              aria-selected={isActive}
              aria-controls={`panel-${tab.id}`}
              tabIndex={isActive ? 0 : -1}
              onclick={() => props.onTabChange(tab.id)}
              {...(isActive ? { 'data-active': '' } : {})}
            >
              {tab.label}
            </button>
          )
        })}
      </div>
    )
  },
})
