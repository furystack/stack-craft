import { createComponent, RouteLink, Shade } from '@furystack/shades'
import { AppBar, Button } from '@furystack/shades-common-components'
import { SessionService } from '../services/session.js'
import { ThemeSwitch } from './theme-switch/index.js'

export type HeaderProps = {
  title: string
  links: Array<{ name: string; url: string }>
}

export const Header = Shade<HeaderProps>({
  shadowDomName: 'shade-app-header',
  css: {
    '& h3': {
      margin: '0 2em 0 0',
      cursor: 'pointer',
    },
    '& route-link': {
      color: '#aaa',
      textDecoration: 'none',
      cursor: 'pointer',
    },
    '& route-link:hover': {
      color: '#fff',
    },
    '& .spacer': {
      flex: '1',
    },
    '& .actions': {
      display: 'flex',
      placeContent: 'center',
      alignItems: 'center',
      gap: '8px',
      marginRight: '24px',
    },
  },
  render: ({ props, injector, useObservable }) => {
    const [sessionState] = useObservable('sessionState', injector.getInstance(SessionService).state)

    return (
      <AppBar id="header">
        <h3>
          <RouteLink title={props.title} href="/">
            {props.title}
          </RouteLink>
        </h3>
        <div className="spacer" />
        <div className="actions">
          <ThemeSwitch variant="outlined" />
          {sessionState === 'authenticated' ? (
            <Button variant="outlined" onclick={() => injector.getInstance(SessionService).logout()}>
              Log Out
            </Button>
          ) : null}
        </div>
      </AppBar>
    )
  },
})
