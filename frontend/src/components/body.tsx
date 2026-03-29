import type { Injector } from '@furystack/inject'
import { createComponent, NestedRouter, Shade } from '@furystack/shades'
import { Init, Offline } from '../pages/index.js'
import { NotFound } from '../pages/not-found.js'
import { SessionService } from '../services/session.js'
import { appRoutes } from './app-routes.js'

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
              return <NestedRouter routes={appRoutes} notFound={<NotFound />} />
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
