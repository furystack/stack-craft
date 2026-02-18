import { createComponent, LocationService, NestedRouteLink, Shade } from '@furystack/shades'
import type { IconDefinition } from '@furystack/shades-common-components'
import { cssVariableTheme, Icon, icons } from '@furystack/shades-common-components'
import { match } from 'path-to-regexp'

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

export const Sidebar = Shade({
  shadowDomName: 'shade-sidebar',
  css: {
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
    padding: `${cssVariableTheme.spacing.lg} ${cssVariableTheme.spacing.md}`,
    gap: cssVariableTheme.spacing.xs,
    overflowY: 'auto',
  },
  render: ({ injector, useObservable }) => {
    const [currentUrl] = useObservable('locationChange', injector.getInstance(LocationService).onLocationPathChanged)

    return (
      <div style={{ display: 'contents' }}>
        <SidebarItem href="/" icon={icons.home} label="Dashboard" currentUrl={currentUrl} />
        <SidebarItem href="/settings" icon={icons.settings} label="Settings" currentUrl={currentUrl} />
        <SidebarItem href="/stacks/import" icon={icons.upload} label="Import Stack" currentUrl={currentUrl} />
      </div>
    )
  },
})
