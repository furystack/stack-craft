import type { Injector } from '@furystack/inject'
import { createComponent, NestedRouter, Shade, type NestedRoute } from '@furystack/shades'
import type { MatchResult } from 'path-to-regexp'
import { Dashboard } from '../pages/dashboard/index.js'
import { ExportStack } from '../pages/import-export/export-stack.js'
import { ImportStack } from '../pages/import-export/import-stack.js'
import { Init, Offline } from '../pages/index.js'
import { CreateRepository } from '../pages/repositories/create-repository.js'
import { EditRepository } from '../pages/repositories/edit-repository.js'
import { CreateService } from '../pages/services/create-service.js'
import { ServiceDetail } from '../pages/services/service-detail.js'
import { ServiceLogs } from '../pages/services/service-logs.js'
import { UserSettings } from '../pages/settings/user-settings.js'
import { CreateStack } from '../pages/stacks/create-stack.js'
import { EditStack } from '../pages/stacks/edit-stack.js'
import { StackSetup } from '../pages/stacks/stack-setup.js'
import { CreateServiceWizard } from '../pages/wizards/create-service-wizard.js'
import { SessionService } from '../services/session.js'

const appRoutes = {
  '/': {
    component: () => <Dashboard />,
  },
  '/services/create/:stackName': {
    component: ({ match }: { match: MatchResult<{ stackName: string }> }) => (
      <CreateService stackName={match.params.stackName} />
    ),
  },
  '/services/wizard/:stackName': {
    component: ({ match }: { match: MatchResult<{ stackName: string }> }) => (
      <CreateServiceWizard stackName={match.params.stackName} />
    ),
  },
  '/services/:id/logs/:processUid': {
    component: ({ match }: { match: MatchResult<{ id: string; processUid: string }> }) => (
      <ServiceLogs serviceId={match.params.id} processUid={match.params.processUid} />
    ),
  },
  '/services/:id/logs': {
    component: ({ match }: { match: MatchResult<{ id: string }> }) => <ServiceLogs serviceId={match.params.id} />,
  },
  '/services/:id': {
    component: ({ match }: { match: MatchResult<{ id: string }> }) => <ServiceDetail serviceId={match.params.id} />,
  },
  '/repositories/create/:stackName': {
    component: ({ match }: { match: MatchResult<{ stackName: string }> }) => (
      <CreateRepository stackName={match.params.stackName} />
    ),
  },
  '/repositories/:id': {
    component: ({ match }: { match: MatchResult<{ id: string }> }) => <EditRepository repositoryId={match.params.id} />,
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
  '/stacks/:name/setup': {
    component: ({ match }: { match: MatchResult<{ name: string }> }) => <StackSetup stackName={match.params.name} />,
  },
  '/stacks/:name/edit': {
    component: ({ match }: { match: MatchResult<{ name: string }> }) => <EditStack stackName={match.params.name} />,
  },
  '/stacks/:name': {
    component: ({ match }: { match: MatchResult<{ name: string }> }) => <Dashboard stackName={match.params.name} />,
  },
  '/stacks/:name/export': {
    component: ({ match }: { match: MatchResult<{ name: string }> }) => <ExportStack stackName={match.params.name} />,
  },
} satisfies Record<string, NestedRoute<any>>

export const Body = Shade<{ style?: Partial<CSSStyleDeclaration>; injector?: Injector }>({
  customElementName: 'shade-app-body',
  render: ({ injector, useObservable }) => {
    const session = injector.getInstance(SessionService)
    const [sessionState] = useObservable('sessionState', session.state)
    return (
      <div id="Body">
        {(() => {
          switch (sessionState) {
            case 'authenticated':
              return <NestedRouter routes={appRoutes} notFound={<Dashboard />} />
            case 'offline':
              return <Offline />
            default:
              return <Init />
          }
        })()}
      </div>
    )
  },
})
