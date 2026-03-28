import type { Injector } from '@furystack/inject'
import { createComponent, Shade } from '@furystack/shades'
import { AppBar, AppBarLink, Button, DrawerToggleButton, Icon, icons } from '@furystack/shades-common-components'
import { SessionService } from '../services/session.js'
import { Breadcrumbs } from './breadcrumbs.js'
import { ThemeSwitch } from './theme-switch/index.js'

export type HeaderProps = {
  title: string
  injector?: Injector
}

export const Header = Shade<HeaderProps>({
  customElementName: 'shade-app-header',
  css: {
    '& h3': {
      margin: '0 1em 0 0',
      cursor: 'pointer',
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
        <DrawerToggleButton position="left" ariaLabel="Toggle navigation" />
        <h3>
          <AppBarLink href="/" title={props.title}>
            {props.title}
          </AppBarLink>
        </h3>
        {sessionState === 'authenticated' ? <Breadcrumbs /> : null}
        <div className="spacer" />
        <div className="actions">
          <ThemeSwitch variant="outlined" />
          {sessionState === 'authenticated' ? (
            <Button
              variant="outlined"
              size="small"
              onclick={() => injector.getInstance(SessionService).logout()}
              startIcon={<Icon icon={icons.logOut} size="small" />}
            >
              Log Out
            </Button>
          ) : null}
        </div>
      </AppBar>
    )
  },
})
