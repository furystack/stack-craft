import { useCollectionSync } from '@furystack/entity-sync-client'
import type { Injector } from '@furystack/inject'
import { createComponent, LocationService, NestedRouteLink, Shade } from '@furystack/shades'
import { cssVariableTheme, Divider, Icon, icons } from '@furystack/shades-common-components'
import type { StackView } from 'common'
import { StackDefinition } from 'common'
import { match } from 'path-to-regexp'

type SidebarStackLinkProps = {
  stackName: string
  href: string
  label: string
  currentUrl: string
}

const SidebarStackLink = Shade<SidebarStackLinkProps>({
  customElementName: 'shade-sidebar-stack-link',
  css: {
    display: 'block',
    '& a': {
      display: 'block',
      padding: '7px 16px 7px 44px',
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
  },
  render: ({ props }) => {
    const isActive = !!match(props.href, { end: true })(props.currentUrl)
    return (
      <NestedRouteLink href={props.href} {...(isActive ? { 'data-active': '' } : {})}>
        {props.label}
      </NestedRouteLink>
    )
  },
})

type SidebarStackCategoryProps = {
  stack: StackView
  currentUrl: string
}

const SidebarStackCategory = Shade<SidebarStackCategoryProps>({
  customElementName: 'shade-sidebar-stack-category',
  css: {
    display: 'block',
    marginBottom: '2px',
    '& .category-header': {
      display: 'flex',
      alignItems: 'center',
      gap: '8px',
      padding: '8px 12px',
      cursor: 'pointer',
      fontSize: '0.82rem',
      fontWeight: '500',
      letterSpacing: '0.02em',
      userSelect: 'none',
      borderRadius: cssVariableTheme.shape.borderRadius.sm,
      margin: '0 8px',
      transition: `background ${cssVariableTheme.transitions.duration.fast} ease, color ${cssVariableTheme.transitions.duration.fast} ease`,
    },
    '& .category-header:hover': {
      background: cssVariableTheme.action.hoverBackground,
    },
    '& .category-header[data-active]': {
      color: cssVariableTheme.palette.primary.main,
      fontWeight: '600',
    },
    '& .expand-arrow': {
      fontSize: '0.55rem',
      width: '12px',
      textAlign: 'center',
      transition: `transform ${cssVariableTheme.transitions.duration.normal} ease`,
      display: 'inline-block',
    },
    '& .expand-arrow[data-expanded]': {
      transform: 'rotate(90deg)',
    },
    '& .category-children': {
      paddingBottom: '4px',
    },
  },
  render: ({ props, useState }) => {
    const stackPrefix = `/stacks/${props.stack.name}`
    const isCategoryActive = props.currentUrl === stackPrefix || props.currentUrl.startsWith(`${stackPrefix}/`)

    const [isExpanded, setIsExpanded] = useState('isExpanded', isCategoryActive)

    if (isCategoryActive && !isExpanded) {
      setIsExpanded(true)
    }

    return (
      <div>
        <div
          className="category-header"
          {...(isCategoryActive ? { 'data-active': '' } : {})}
          onclick={() => setIsExpanded(!isExpanded)}
        >
          <span className="expand-arrow" {...(isExpanded ? { 'data-expanded': '' } : {})}>
            ▶
          </span>
          <Icon icon={icons.layers} size={16} />
          <span>{props.stack.displayName}</span>
        </div>
        {isExpanded ? (
          <div className="category-children">
            <SidebarStackLink
              stackName={props.stack.name}
              href={`/stacks/${props.stack.name}`}
              label="Overview"
              currentUrl={props.currentUrl}
            />
          </div>
        ) : null}
      </div>
    )
  },
})

type SidebarItemProps = {
  href: string
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
      <NestedRouteLink href={props.href}>
        <Icon icon={props.icon} size="small" />
        {props.label}
      </NestedRouteLink>
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
  },
  render: (options) => {
    const { injector, useObservable } = options
    const [currentUrl] = useObservable('locationChange', injector.getInstance(LocationService).onLocationPathChanged)

    const stacksState = useCollectionSync(options, StackDefinition, {})
    const stacks = (
      stacksState.status === 'synced' || stacksState.status === 'cached' ? stacksState.data.entries : []
    ) as StackView[]

    return (
      <nav style={{ padding: '4px 0 8px' }}>
        <div className="sidebar-section-label">Stacks</div>
        {stacks.map((stack) => (
          <SidebarStackCategory stack={stack} currentUrl={currentUrl} />
        ))}
        <SidebarItem href="/stacks/create" icon={icons.plus} label="Create Stack" currentUrl={currentUrl} />
        <SidebarItem href="/stacks/import" icon={icons.upload} label="Import Stack" currentUrl={currentUrl} />
        <Divider />
        <SidebarItem href="/settings" icon={icons.settings} label="Settings" currentUrl={currentUrl} />
      </nav>
    )
  },
})
