import { useCollectionSync } from '@furystack/entity-sync-client'
import type { Injector } from '@furystack/inject'
import { createComponent, LocationService, Shade } from '@furystack/shades'
import { Accordion, AccordionItem, cssVariableTheme, Divider, Icon, icons } from '@furystack/shades-common-components'
import type { StackView } from 'common'
import { StackDefinition } from 'common'
import { match } from 'path-to-regexp'

import type { StaticAppRoutePath } from '../app-routes.js'
import { StackCraftNestedRouteLink } from '../app-routes.js'

/**
 * Per-instance scratch for the location subscription merges.
 * Shades `useState` has no functional updates, so the subscription reads the
 * latest remount-phase map via this mutable container instead of a stale closure.
 */
type RemountScratch = { map: Record<string, 0 | 1> }

type SidebarStackLinkProps = {
  stackName: string
  subPath?: string
  label: string
  icon: typeof icons.home
  currentUrl: string
}

const SidebarStackLink = Shade<SidebarStackLinkProps>({
  customElementName: 'shade-sidebar-stack-link',
  css: {
    display: 'block',
    '& a': {
      display: 'flex',
      alignItems: 'center',
      gap: '8px',
      padding: '7px 12px 7px 40px',
      textDecoration: 'none',
      color: 'inherit',
      fontSize: '0.84rem',
      borderRadius: cssVariableTheme.shape.borderRadius.sm,
      borderLeft: '3px solid transparent',
      margin: '1px 8px 1px 0',
      transition: `background ${cssVariableTheme.transitions.duration.fast} ease, border-color ${cssVariableTheme.transitions.duration.fast} ease, color ${cssVariableTheme.transitions.duration.fast} ease`,
    },
    '& a:hover': {
      background: cssVariableTheme.action.hoverBackground,
    },
    '& a[data-active]': {
      color: cssVariableTheme.palette.primary.main,
      fontWeight: cssVariableTheme.typography.fontWeight.semibold,
      background: cssVariableTheme.action.hoverBackground,
      borderLeftColor: cssVariableTheme.palette.primary.main,
    },
    '& .link-label': {
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      whiteSpace: 'nowrap',
      minWidth: '0',
    },
  },
  render: ({ props }) => {
    const compiledHref = `/stacks/${props.stackName}${props.subPath ? `/${props.subPath}` : ''}`
    const isActive = props.subPath
      ? props.currentUrl.startsWith(compiledHref)
      : !!match(compiledHref, { end: true })(props.currentUrl)

    const href = props.subPath
      ? (`/stacks/:stackName/${props.subPath}` as '/stacks/:stackName/services')
      : '/stacks/:stackName'

    return (
      <StackCraftNestedRouteLink
        path={href}
        params={{ stackName: props.stackName }}
        title={props.label}
        {...(isActive ? { 'data-active': '' } : {})}
      >
        <Icon icon={props.icon} size={14} style={{ flexShrink: '0' }} />
        <span className="link-label">{props.label}</span>
      </StackCraftNestedRouteLink>
    )
  },
})

type SidebarItemProps = {
  href: StaticAppRoutePath
  icon: typeof icons.home
  label: string
  currentUrl: string
}

const SidebarItem = Shade<SidebarItemProps>({
  customElementName: 'shade-sidebar-item',
  css: {
    display: 'block',

    '& a': {
      display: 'flex',
      alignItems: 'center',
      gap: cssVariableTheme.spacing.sm,
      padding: `${cssVariableTheme.spacing.sm} ${cssVariableTheme.spacing.md}`,
      borderRadius: cssVariableTheme.shape.borderRadius.md,
      color: cssVariableTheme.text.secondary,
      textDecoration: 'none',
      fontSize: cssVariableTheme.typography.fontSize.md,
      transition: `background-color ${cssVariableTheme.transitions.duration.normal} ${cssVariableTheme.transitions.easing.easeInOut}, color ${cssVariableTheme.transitions.duration.normal} ${cssVariableTheme.transitions.easing.easeInOut}`,
      cursor: 'pointer',
    },

    '& a:hover': {
      backgroundColor: cssVariableTheme.button.hover,
      color: cssVariableTheme.text.primary,
    },

    '&[data-active] a': {
      backgroundColor: cssVariableTheme.button.hover,
      color: cssVariableTheme.text.primary,
      fontWeight: cssVariableTheme.typography.fontWeight.semibold,
    },
  },
  render: ({ props, useHostProps }) => {
    const isActive = !!match(props.href, { end: props.href === '/' })(props.currentUrl)

    if (isActive) {
      useHostProps({ 'data-active': '' })
    }

    return (
      <StackCraftNestedRouteLink path={props.href}>
        <Icon icon={props.icon} size="small" />
        {props.label}
      </StackCraftNestedRouteLink>
    )
  },
})

export const Sidebar = Shade<{ injector?: Injector }>({
  customElementName: 'shade-sidebar',
  css: {
    display: 'block',
    height: '100%',
    overflow: 'hidden auto',
    color: cssVariableTheme.text.primary,
    scrollbarWidth: 'thin',
    scrollbarGutter: 'stable',
    '&::-webkit-scrollbar': {
      width: '4px',
    },
    '&::-webkit-scrollbar-thumb': {
      background: 'transparent',
      borderRadius: '4px',
    },
    '&:hover::-webkit-scrollbar-thumb': {
      background: 'rgba(128,128,128,0.4)',
    },
    '& .sidebar-section-label': {
      padding: '12px 20px 4px',
      fontSize: '0.68rem',
      fontWeight: '600',
      letterSpacing: '0.08em',
      textTransform: 'uppercase',
      color: cssVariableTheme.text.secondary,
      userSelect: 'none',
    },
    '& .sidebar-stacks-accordion': {
      margin: '0 8px 4px',
    },
    '& .sidebar-stack-accordion-links': {
      margin: '0 -12px 0 -8px',
      paddingBottom: '4px',
    },
  },
  render: (options) => {
    const { injector, useObservable, useState, useDisposable } = options
    const [currentUrl] = useObservable('locationChange', injector.getInstance(LocationService).onLocationPathChanged)

    const stacksState = useCollectionSync(options, StackDefinition, {})
    const stacks = (
      stacksState.status === 'synced' || stacksState.status === 'cached' ? stacksState.data.entries : []
    ) as StackView[]

    const stackIds = stacks.map((s) => s.name).join('\0')

    const [remountPhaseByStack, setRemountPhaseByStack] = useState<Record<string, 0 | 1>>('remountPhaseByStack', {})
    const [remountScratch] = useState<RemountScratch>('remountScratch', { map: {} })
    remountScratch.map = remountPhaseByStack

    useDisposable(
      'sidebar-stack-accordion-sync',
      () => {
        const locationService = injector.getInstance(LocationService)
        let lastUrl = locationService.onLocationPathChanged.getValue()
        const observer = locationService.onLocationPathChanged.subscribe((url) => {
          const nextPhase: Record<string, 0 | 1> = {}
          for (const stack of stacks) {
            const stackPrefix = `/stacks/${stack.name}`
            const wasActive = lastUrl === stackPrefix || lastUrl.startsWith(`${stackPrefix}/`)
            const nowActive = url === stackPrefix || url.startsWith(`${stackPrefix}/`)
            if (wasActive !== nowActive) {
              nextPhase[stack.name] = 1
            }
          }
          lastUrl = url
          if (Object.keys(nextPhase).length > 0) {
            const merged = { ...remountScratch.map, ...nextPhase }
            setRemountPhaseByStack(merged)
            queueMicrotask(() => {
              const cleared = { ...merged }
              for (const name of Object.keys(nextPhase)) {
                cleared[name] = 0
              }
              setRemountPhaseByStack(cleared)
            })
          }
        })
        return observer
      },
      [stackIds],
    )

    return (
      <nav aria-label="Main navigation" style={{ padding: '4px 0 8px' }}>
        <SidebarItem href="/" icon={icons.home} label="Dashboard" currentUrl={currentUrl} />
        <Divider />
        <div className="sidebar-section-label">Stacks</div>
        {stacks.length > 0 ? (
          <Accordion className="sidebar-stacks-accordion" variant="outlined" navSection="sidebar-stacks">
            {stacks.map((stack) => {
              const stackPrefix = `/stacks/${stack.name}`
              const isCategoryActive = currentUrl === stackPrefix || currentUrl.startsWith(`${stackPrefix}/`)
              const showAccordion = (remountPhaseByStack[stack.name] ?? 0) === 0

              return showAccordion ? (
                <AccordionItem
                  defaultExpanded={isCategoryActive}
                  icon={<Icon icon={icons.layers} size={16} style={{ flexShrink: '0' }} />}
                  title={stack.displayName}
                >
                  <div className="sidebar-stack-accordion-links">
                    <SidebarStackLink
                      stackName={stack.name}
                      icon={icons.layers}
                      label="Overview"
                      currentUrl={currentUrl}
                    />
                    <SidebarStackLink
                      stackName={stack.name}
                      subPath="services"
                      icon={icons.code}
                      label="Services"
                      currentUrl={currentUrl}
                    />
                    <SidebarStackLink
                      stackName={stack.name}
                      subPath="repositories"
                      icon={icons.link}
                      label="Repositories"
                      currentUrl={currentUrl}
                    />
                    <SidebarStackLink
                      stackName={stack.name}
                      subPath="prerequisites"
                      icon={icons.check}
                      label="Prerequisites"
                      currentUrl={currentUrl}
                    />
                    <SidebarStackLink
                      stackName={stack.name}
                      subPath="setup"
                      icon={icons.settings}
                      label="Setup"
                      currentUrl={currentUrl}
                    />
                  </div>
                </AccordionItem>
              ) : (
                <span style={{ display: 'none' }} aria-hidden="true" />
              )
            })}
          </Accordion>
        ) : null}
        <SidebarItem href="/stacks/create" icon={icons.plus} label="Create Stack" currentUrl={currentUrl} />
        <SidebarItem href="/stacks/import" icon={icons.upload} label="Import Stack" currentUrl={currentUrl} />
        <Divider />
        <SidebarItem href="/settings" icon={icons.settings} label="Settings" currentUrl={currentUrl} />
      </nav>
    )
  },
})
