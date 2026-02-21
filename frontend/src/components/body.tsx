import type { Injector } from '@furystack/inject'
import { createComponent, NestedRouter, Shade } from '@furystack/shades'
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
    component: ({ match }) => <CreateService stackName={match.params.stackName} />,
  },
  '/services/wizard/:stackName': {
    component: ({ match }) => <CreateServiceWizard stackName={match.params.stackName} />,
  },
  '/services/:id/logs': {
    component: ({ match }) => <ServiceLogs serviceId={match.params.id} />,
  },
  '/services/:id': {
    component: ({ match }) => <ServiceDetail serviceId={match.params.id} />,
  },
  '/repositories/create/:stackName': {
    component: ({ match }) => <CreateRepository stackName={match.params.stackName} />,
  },
  '/repositories/:id': {
    component: ({ match }) => <EditRepository repositoryId={match.params.id} />,
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
    component: ({ match }) => <StackSetup stackName={match.params.name} />,
  },
  '/stacks/:name/edit': {
    component: ({ match }) => <EditStack stackName={match.params.name} />,
  },
  '/stacks/:name': {
    component: ({ match }) => <Dashboard stackName={match.params.name} />,
  },
  '/stacks/:name/export': {
    component: ({ match }) => <ExportStack stackName={match.params.name} />,
  },
} satisfies Record<string, { component: (options: { match: { params: Record<string, string> } }) => JSX.Element }>

export const Body = Shade<{ style?: Partial<CSSStyleDeclaration>; injector?: Injector }>({
  shadowDomName: 'shade-app-body',
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
