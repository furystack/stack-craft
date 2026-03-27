import type { Injector } from '@furystack/inject'
import { createComponent, NestedRouter, Shade } from '@furystack/shades'
import { Dashboard } from '../pages/dashboard/index.js'
import { Init, Offline } from '../pages/index.js'
import { SessionService } from '../services/session.js'
import { appRoutes } from './app-routes.js'
import { Breadcrumbs } from './breadcrumbs.js'

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
              return (
                <div>
                  <div style={{ padding: '0 24px' }}>
                    <Breadcrumbs />
                  </div>
                  <NestedRouter routes={appRoutes} notFound={<Dashboard />} />
                </div>
              )
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
