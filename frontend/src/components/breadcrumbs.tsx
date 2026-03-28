import { useEntitySync } from '@furystack/entity-sync-client'
import { createComponent, LocationService, Shade } from '@furystack/shades'
import { cssVariableTheme } from '@furystack/shades-common-components'
import { GitHubRepository as GitHubRepositoryModel, ServiceDefinition, StackDefinition } from 'common'

import { StackCraftNestedRouteLink } from './app-routes.js'

type BreadcrumbSegment = {
  label: string
  href?: Parameters<typeof StackCraftNestedRouteLink>[0]['href']
  params?: Record<string, string>
}

const parseBreadcrumbs = (
  pathname: string,
): { segments: BreadcrumbSegment[]; stackName?: string; serviceId?: string; repositoryId?: string } => {
  const segments: BreadcrumbSegment[] = []
  const parts = pathname.split('/').filter(Boolean)
  if (parts[0] !== 'stacks' || parts.length < 2) return { segments }

  let serviceId: string | undefined
  let repositoryId: string | undefined

  const stackName = parts[1]
  if (stackName === 'create' || stackName === 'import') return { segments }

  segments.push({
    label: stackName,
    href: '/stacks/:stackName',
    params: { stackName },
  })

  const subSection = parts[2]
  if (!subSection) return { segments, stackName }

  if (subSection === 'services') {
    segments.push({
      label: 'Services',
      href: '/stacks/:stackName/services',
      params: { stackName },
    })

    serviceId = parts[3]
    if (serviceId && serviceId !== 'create' && serviceId !== 'wizard') {
      segments.push({
        label: serviceId,
        href: '/stacks/:stackName/services/:serviceId',
        params: { stackName, serviceId },
      })

      const logSection = parts[4]
      if (logSection === 'logs') {
        const processUid = parts[5]
        if (processUid) {
          segments.push({
            label: 'Logs',
            href: '/stacks/:stackName/services/:serviceId/logs',
            params: { stackName, serviceId },
          })
          segments.push({ label: `${processUid.slice(0, 8)}…` })
        } else {
          segments.push({ label: 'Logs' })
        }
      }
    } else if (serviceId === 'create') {
      segments.push({ label: 'Create' })
    } else if (serviceId === 'wizard') {
      segments.push({ label: 'Create' })
    }
  } else if (subSection === 'repositories') {
    segments.push({
      label: 'Repositories',
      href: '/stacks/:stackName/repositories',
      params: { stackName },
    })

    repositoryId = parts[3]
    if (repositoryId && repositoryId !== 'create') {
      segments.push({ label: repositoryId })
    } else if (repositoryId === 'create') {
      segments.push({ label: 'Add' })
    }
  } else if (subSection === 'prerequisites') {
    segments.push({ label: 'Prerequisites' })
  } else if (subSection === 'edit') {
    segments.push({ label: 'Edit' })
  } else if (subSection === 'export') {
    segments.push({ label: 'Export' })
  } else if (subSection === 'setup') {
    segments.push({ label: 'Setup' })
  }

  return { segments, stackName, serviceId, repositoryId }
}

type EntityNameResolverProps = {
  stackName?: string
  serviceId?: string
  repositoryId?: string
  segments: BreadcrumbSegment[]
}

const EntityNameResolver = Shade<EntityNameResolverProps>({
  customElementName: 'shade-entity-name-resolver',
  css: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    fontSize: '13px',
    color: cssVariableTheme.text.secondary,
    flexWrap: 'wrap',
    '& a': {
      color: cssVariableTheme.text.secondary,
      textDecoration: 'none',
      transition: `color ${cssVariableTheme.transitions.duration.fast} ease`,
    },
    '& a:hover': {
      color: cssVariableTheme.text.primary,
    },
    '& .breadcrumb-current': {
      color: cssVariableTheme.text.primary,
      fontWeight: cssVariableTheme.typography.fontWeight.semibold,
    },
    '& .breadcrumb-separator': {
      opacity: '0.4',
      fontSize: '11px',
    },
  },
  render: (options) => {
    const { props } = options
    const resolved = [...props.segments]

    const stackState = props.stackName ? useEntitySync(options, StackDefinition, props.stackName) : undefined
    const serviceState = props.serviceId ? useEntitySync(options, ServiceDefinition, props.serviceId) : undefined
    const repoState = props.repositoryId ? useEntitySync(options, GitHubRepositoryModel, props.repositoryId) : undefined

    if (stackState?.status === 'synced' && stackState.data) {
      const stackSeg = resolved.find((s) => s.label === props.stackName)
      if (stackSeg) stackSeg.label = stackState.data.displayName
    }

    if (serviceState?.status === 'synced' && serviceState.data) {
      const svcSeg = resolved.find((s) => s.label === props.serviceId)
      if (svcSeg) svcSeg.label = serviceState.data.displayName
    }

    if (repoState?.status === 'synced' && repoState.data) {
      const repoSeg = resolved.find((s) => s.label === props.repositoryId)
      if (repoSeg) repoSeg.label = repoState.data.displayName
    }

    return (
      <nav>
        {resolved.map((segment, index) => {
          const isLast = index === resolved.length - 1
          return (
            <span>
              {index > 0 ? <span className="breadcrumb-separator"> / </span> : null}
              {segment.href && !isLast ? (
                <StackCraftNestedRouteLink href={segment.href} params={segment.params as Record<string, string>}>
                  {segment.label}
                </StackCraftNestedRouteLink>
              ) : (
                <span className={isLast ? 'breadcrumb-current' : ''}>{segment.label}</span>
              )}
            </span>
          )
        })}
      </nav>
    )
  },
})

export const Breadcrumbs = Shade({
  customElementName: 'shade-breadcrumbs',
  render: ({ injector, useObservable }) => {
    const [currentUrl] = useObservable('locationChange', injector.getInstance(LocationService).onLocationPathChanged)

    const { segments, stackName, serviceId, repositoryId } = parseBreadcrumbs(currentUrl)

    if (segments.length === 0) return <span />

    return (
      <EntityNameResolver segments={segments} stackName={stackName} serviceId={serviceId} repositoryId={repositoryId} />
    )
  },
})
