import type { Injector } from '@furystack/inject'
import { useCollectionSync } from '@furystack/entity-sync-client'
import { createComponent, LocationService, NestedRouteLink, Shade } from '@furystack/shades'
import type { IconDefinition } from '@furystack/shades-common-components'
import { cssVariableTheme, Divider, Icon, icons } from '@furystack/shades-common-components'
import { Stack } from 'common'
import { match } from 'path-to-regexp'

type SidebarProps = {
  injector?: Injector
}

type SidebarItemProps = {
  href: string
  icon: IconDefinition
  label: string
  currentUrl: string
}

const SidebarItem = Shade<SidebarItemProps>({
  shadowDomName: 'shade-sidebar-item',
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
      <NestedRouteLink href={props.href}>
        <Icon icon={props.icon} size="small" />
        {props.label}
      </NestedRouteLink>
    )
  },
})

export const Sidebar = Shade<SidebarProps>({
  shadowDomName: 'shade-sidebar',
  css: {
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
    padding: `${cssVariableTheme.spacing.lg} ${cssVariableTheme.spacing.md}`,
    gap: cssVariableTheme.spacing.xs,
    overflowY: 'auto',
  },
  render: (options) => {
    const { injector, useObservable } = options
    const [currentUrl] = useObservable('locationChange', injector.getInstance(LocationService).onLocationPathChanged)

    const stacksState = useCollectionSync(options, Stack, {})
    const stacks = stacksState.status === 'synced' || stacksState.status === 'cached' ? stacksState.data : []
    const firstStack = stacks[0]

    return (
      <div style={{ display: 'contents' }}>
        <SidebarItem href="/" icon={icons.home} label="Dashboard" currentUrl={currentUrl} />
        <SidebarItem href="/stacks/create" icon={icons.plus} label="Create Stack" currentUrl={currentUrl} />
        <Divider />
        <SidebarItem href="/stacks/import" icon={icons.upload} label="Import Stack" currentUrl={currentUrl} />
        {firstStack ? (
          <SidebarItem
            href={`/stacks/${firstStack.name}/export`}
            icon={icons.download}
            label="Export Stack"
            currentUrl={currentUrl}
          />
        ) : null}
        <Divider />
        <SidebarItem href="/settings" icon={icons.settings} label="Settings" currentUrl={currentUrl} />
      </div>
    )
  },
})
