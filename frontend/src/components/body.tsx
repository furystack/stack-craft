import { createComponent, NestedRouter, Shade } from '@furystack/shades'
import { Dashboard } from '../pages/dashboard/index.js'
import { ExportStack } from '../pages/import-export/export-stack.js'
import { ImportStack } from '../pages/import-export/import-stack.js'
import { Init, Offline } from '../pages/index.js'
import { ServiceDetail } from '../pages/services/service-detail.js'
import { ServiceLogs } from '../pages/services/service-logs.js'
import { UserSettings } from '../pages/settings/user-settings.js'
import { SessionService } from '../services/session.js'

const appRoutes = {
  '/': {
    component: () => <Dashboard />,
  },
  '/services/:id/logs': {
    component: ({ match }) => <ServiceLogs serviceId={match.params.id} />,
  },
  '/services/:id': {
    component: ({ match }) => <ServiceDetail serviceId={match.params.id} />,
  },
  '/settings': {
    component: () => <UserSettings />,
  },
  '/stacks/import': {
    component: () => <ImportStack />,
  },
  '/stacks/:name/export': {
    component: ({ match }) => <ExportStack stackName={match.params.name} />,
  },
} satisfies Record<string, { component: (options: { match: { params: Record<string, string> } }) => JSX.Element }>

export const Body = Shade<{ style?: Partial<CSSStyleDeclaration> }>({
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
