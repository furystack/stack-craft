import { createComponent, Router, Shade } from '@furystack/shades'
import { ButtonsDemo, HelloWorld, Init, Login, Offline } from '../pages/index.js'
import { SessionService } from '../services/session.js'

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
              return (
                <Router
                  routes={[
                    { url: '/buttons', routingOptions: { end: false }, component: () => <ButtonsDemo /> },
                    { url: '/', routingOptions: { end: false }, component: () => <HelloWorld /> },
                  ]}
                ></Router>
              )
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
