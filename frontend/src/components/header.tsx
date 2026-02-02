import { createComponent, RouteLink, Shade } from '@furystack/shades'
import { AppBar, Button } from '@furystack/shades-common-components'
import { environmentOptions } from '../environment-options.js'
import { SessionService } from '../services/session.js'
import { GithubLogo } from './github-logo/index.js'
import { ThemeSwitch } from './theme-switch/index.js'

export interface HeaderProps {
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
    '& .nav-link': {
      padding: '0 8px',
    },
    '& .spacer': {
      flex: '1',
    },
    '& .actions': {
      display: 'flex',
      placeContent: 'center',
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
        {props.links.map((link) => (
          <RouteLink className="nav-link" title={link.name} href={link.url}>
            {link.name || ''}
          </RouteLink>
        ))}
        <div className="spacer" />
        <div className="actions">
          <ThemeSwitch variant="outlined" />
          <a href={environmentOptions.repository} target="_blank">
            <Button variant="outlined" style={{ verticalAlign: 'baseline' }}>
              <GithubLogo style={{ height: '25px' }} />
            </Button>
          </a>
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
