import { createComponent, createNestedNavigate, createNestedRouteLink, type NestedRoute } from '@furystack/shades'
import type { MatchResult } from 'path-to-regexp'
import { Dashboard } from '../pages/dashboard/index.js'
import { ExportStack } from '../pages/import-export/export-stack.js'
import { ImportStack } from '../pages/import-export/import-stack.js'
import { PrerequisitesList } from '../pages/prerequisites/prerequisites-list.js'
import { CreateRepository } from '../pages/repositories/create-repository.js'
import { EditRepository } from '../pages/repositories/edit-repository.js'
import { RepositoriesList } from '../pages/repositories/repositories-list.js'
import { ServiceDetail } from '../pages/services/service-detail/index.js'
import { ServiceLogs } from '../pages/services/service-logs.js'
import { ServicesList } from '../pages/services/services-list.js'
import { UserSettings } from '../pages/settings/user-settings.js'
import { CreateStack } from '../pages/stacks/create-stack.js'
import { EditStack } from '../pages/stacks/edit-stack.js'
import { StackSetup } from '../pages/stacks/stack-setup.js'
import { CreateServiceWizard } from '../pages/wizards/create-service-wizard/index.js'

export const appRoutes = {
  '/': {
    component: () => <Dashboard />,
  },
  '/settings': {
    component: () => <UserSettings />,
  },
  '/stacks/create': {
    component: () => <CreateStack />,
  },
  '/stacks/import': {
    component: () => <ImportStack />,
  },
  '/stacks/:stackName': {
    component: ({ match }: { match: MatchResult<{ stackName: string }> }) => (
      <Dashboard stackName={match.params.stackName} />
    ),
  },
  '/stacks/:stackName/edit': {
    component: ({ match }: { match: MatchResult<{ stackName: string }> }) => (
      <EditStack stackName={match.params.stackName} />
    ),
  },
  '/stacks/:stackName/export': {
    component: ({ match }: { match: MatchResult<{ stackName: string }> }) => (
      <ExportStack stackName={match.params.stackName} />
    ),
  },
  '/stacks/:stackName/setup': {
    component: ({ match }: { match: MatchResult<{ stackName: string }> }) => (
      <StackSetup stackName={match.params.stackName} />
    ),
  },
  '/stacks/:stackName/services': {
    component: ({ match }: { match: MatchResult<{ stackName: string }> }) => (
      <ServicesList stackName={match.params.stackName} />
    ),
  },
  '/stacks/:stackName/services/wizard': {
    component: ({ match }: { match: MatchResult<{ stackName: string }> }) => (
      <CreateServiceWizard stackName={match.params.stackName} />
    ),
  },
  '/stacks/:stackName/services/:serviceId/logs/:processUid': {
    component: ({ match }: { match: MatchResult<{ stackName: string; serviceId: string; processUid: string }> }) => (
      <ServiceLogs
        stackName={match.params.stackName}
        serviceId={match.params.serviceId}
        processUid={match.params.processUid}
      />
    ),
  },
  '/stacks/:stackName/services/:serviceId/logs': {
    component: ({ match }: { match: MatchResult<{ stackName: string; serviceId: string }> }) => (
      <ServiceLogs stackName={match.params.stackName} serviceId={match.params.serviceId} />
    ),
  },
  '/stacks/:stackName/services/:serviceId': {
    component: ({ match }: { match: MatchResult<{ stackName: string; serviceId: string }> }) => (
      <ServiceDetail stackName={match.params.stackName} serviceId={match.params.serviceId} />
    ),
  },
  '/stacks/:stackName/repositories': {
    component: ({ match }: { match: MatchResult<{ stackName: string }> }) => (
      <RepositoriesList stackName={match.params.stackName} />
    ),
  },
  '/stacks/:stackName/repositories/create': {
    component: ({ match }: { match: MatchResult<{ stackName: string }> }) => (
      <CreateRepository stackName={match.params.stackName} />
    ),
  },
  '/stacks/:stackName/repositories/:repositoryId': {
    component: ({ match }: { match: MatchResult<{ stackName: string; repositoryId: string }> }) => (
      <EditRepository stackName={match.params.stackName} repositoryId={match.params.repositoryId} />
    ),
  },
  '/stacks/:stackName/prerequisites': {
    component: ({ match }: { match: MatchResult<{ stackName: string }> }) => (
      <PrerequisitesList stackName={match.params.stackName} />
    ),
  },
} as const satisfies Record<string, NestedRoute<any>> // NestedRouterProps requires `any` for heterogeneous route params

export const StackCraftNestedRouteLink = createNestedRouteLink<typeof appRoutes>()

export const stackCraftNavigate = createNestedNavigate<typeof appRoutes>()

export type AppRoutePath = keyof typeof appRoutes

export type StaticAppRoutePath = {
  [K in AppRoutePath]: K extends `${string}:${string}` ? never : K
}[AppRoutePath]
