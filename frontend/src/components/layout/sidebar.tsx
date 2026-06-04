import { useCollectionSync } from '../../services/entity-sync.js'
import type { Injector } from '@furystack/inject'
import { createComponent, LocationService, Shade } from '@furystack/shades'
import { Accordion, cssVariableTheme, Divider, Icon, icons } from '@furystack/shades-common-components'
import type { ServiceView, StackView } from 'common'
import { mergeServiceView, ServiceConfig, ServiceDefinition, ServiceStatus, StackDefinition } from 'common'
import { match } from 'path-to-regexp'

import type { StaticAppRoutePath } from '../app-routes.js'
import { StackCraftNestedRouteLink } from '../app-routes.js'
import { SidebarStackItem } from './sidebar-stack-item.js'

/**
 * Per-instance scratch for the location subscription merges.
 * Shades `useState` has no functional updates, so the subscription reads the
 * latest remount-phase map via this mutable container instead of a stale closure.
 */
type RemountScratch = { map: Record<string, 0 | 1> }

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
  },
  render: (options) => {
    const { injector, useObservable, useState, useDisposable } = options
    const [currentUrl] = useObservable('locationChange', injector.get(LocationService).onLocationPathChanged)

    const stacksState = useCollectionSync(options, StackDefinition, {})
    const stacks = (
      stacksState.status === 'synced' || stacksState.status === 'cached' ? stacksState.data.entries : []
    ) as StackView[]

    const defsState = useCollectionSync(options, ServiceDefinition, {})
    const defs = defsState.status === 'synced' || defsState.status === 'cached' ? defsState.data.entries : []

    const statusesState = useCollectionSync(options, ServiceStatus, {})
    const statuses =
      statusesState.status === 'synced' || statusesState.status === 'cached' ? statusesState.data.entries : []

    const configsState = useCollectionSync(options, ServiceConfig, {})
    const configs =
      configsState.status === 'synced' || configsState.status === 'cached' ? configsState.data.entries : []

    const statusMap = new Map(statuses.map((s) => [s.serviceId, s]))
    const configMap = new Map(configs.map((c) => [c.serviceId, c]))

    const servicesByStack = new Map<string, ServiceView[]>()
    for (const def of defs) {
      const svc = mergeServiceView(def, configMap.get(def.id), statusMap.get(def.id))
      const list = servicesByStack.get(def.stackName) ?? []
      list.push(svc)
      servicesByStack.set(def.stackName, list)
    }

    const stackIds = stacks.map((s) => s.name).join('\0')

    const [remountPhaseByStack, setRemountPhaseByStack] = useState<Record<string, 0 | 1>>('remountPhaseByStack', {})
    const [remountScratch] = useState<RemountScratch>('remountScratch', { map: {} })
    remountScratch.map = remountPhaseByStack

    useDisposable(
      'sidebar-stack-accordion-sync',
      () => {
        const locationService = injector.get(LocationService)
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
            {stacks.map((stack) => (
              <SidebarStackItem
                stack={stack}
                stackServices={servicesByStack.get(stack.name) ?? []}
                currentUrl={currentUrl}
                showAccordion={(remountPhaseByStack[stack.name] ?? 0) === 0}
              />
            ))}
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
