import { createComponent, Shade } from '@furystack/shades'
import { AccordionItem, cssVariableTheme, Icon, icons } from '@furystack/shades-common-components'
import type { ServiceView, StackView } from 'common'
import { match } from 'path-to-regexp'

import { StackCraftNestedRouteLink } from '../app-routes.js'
import { formatStackRunSummaryTooltip, getStackRunSummary, getStackStatusPaletteKey } from '../../utils/stack-status.js'

type SidebarStackLinkProps = {
  stackName: string
  subPath?: string
  label: string
  count?: number
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
      flex: '1',
    },
    '& .link-count': {
      fontSize: '0.75rem',
      opacity: '0.6',
      flexShrink: '0',
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
        {props.count !== undefined ? <span className="link-count">{props.count}</span> : null}
      </StackCraftNestedRouteLink>
    )
  },
})

export type SidebarStackItemProps = {
  stack: StackView
  stackServices: ServiceView[]
  currentUrl: string
  showAccordion: boolean
}

export const SidebarStackItem = Shade<SidebarStackItemProps>({
  customElementName: 'shade-sidebar-stack-item',
  css: {
    '& .stack-status-dot': {
      width: '8px',
      height: '8px',
      borderRadius: '50%',
      flexShrink: '0',
    },
    '& .sidebar-stack-accordion-links': {
      margin: '0 -12px 0 -8px',
      paddingBottom: '4px',
    },
  },
  render: ({ props }) => {
    const { stack, stackServices, currentUrl, showAccordion } = props
    const stackPrefix = `/stacks/${stack.name}`
    const isCategoryActive = currentUrl === stackPrefix || currentUrl.startsWith(`${stackPrefix}/`)
    const runSummary = getStackRunSummary(stackServices)
    const dotColor = getStackStatusPaletteKey(runSummary.status)

    if (!showAccordion) {
      return <span style={{ display: 'none' }} aria-hidden="true" />
    }

    return (
      <AccordionItem
        defaultExpanded={isCategoryActive}
        icon={
          <span
            className="stack-status-dot"
            data-testid="stack-status-dot"
            title={formatStackRunSummaryTooltip(runSummary)}
            style={{ backgroundColor: cssVariableTheme.palette[dotColor].main }}
          />
        }
        title={stack.displayName}
      >
        <div className="sidebar-stack-accordion-links">
          <SidebarStackLink
            stackName={stack.name}
            subPath="services"
            icon={icons.code}
            label="Services"
            count={stackServices.length}
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
        </div>
      </AccordionItem>
    )
  },
})
