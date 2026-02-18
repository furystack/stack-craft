import { createComponent, Router, Shade } from '@furystack/shades'
import { Init, Login, Offline } from '../pages/index.js'
import { SessionService } from '../services/session.js'
import { Dashboard } from '../pages/dashboard/index.js'

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
              return <Router routes={[{ url: '/', routingOptions: { end: false }, component: () => <Dashboard /> }]} />
            case 'offline':
              return <Offline />
            case 'unauthenticated':
              return <Login />
            default:
              return <Init />
          }
        })()}
      </div>
    )
  },
})
