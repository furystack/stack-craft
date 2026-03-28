import { EntitySyncService } from '@furystack/entity-sync-client'
import { createComponent, Shade } from '@furystack/shades'
import { cssVariableTheme, NotyList, PageLayout, ThemeProviderService } from '@furystack/shades-common-components'
import { environmentOptions } from '../environment-options.js'
import { Init } from '../pages/init.js'
import { Login } from '../pages/login.js'
import { InstallService } from '../services/install-service.js'
import { SessionService } from '../services/session.js'
import { applyTheme, DEFAULT_THEME_KEY, THEME_STORAGE_KEY } from '../services/theme-registry.js'
import { Body } from './body.js'
import { Header } from './header.js'
import { Sidebar } from './sidebar.js'

export const Layout = Shade({
  customElementName: 'shade-app-layout',
  css: {
    width: '100%',
    height: '100%',
    position: 'absolute',
    top: '0',
    left: '0',
    padding: '0',
    margin: '0',
    background: cssVariableTheme.background.default,
  },
  render: ({ injector, useState, useObservable, useStoredState }) => {
    const [themeKey] = useStoredState<string>(THEME_STORAGE_KEY, DEFAULT_THEME_KEY)
    const themeProvider = injector.getInstance(ThemeProviderService)
    void applyTheme(themeKey, themeProvider)

    const [installState, setInstallState] = useState<'loading' | 'installed' | 'needsInstall' | 'error'>(
      'installState',
      'loading',
    )

    if (installState === 'loading') {
      void injector
        .getInstance(InstallService)
        .getServiceStatus()
        .then((result) => setInstallState(result.state))
        .catch(() => setInstallState('error'))

      return <Init />
    }

    if (installState === 'needsInstall') {
      return (
        <div>
          <NotyList style={{ zIndex: '2' }} />
          <LazyInstallerPage />
        </div>
      )
    }

    const session = injector.getInstance(SessionService)
    const [sessionState] = useObservable('sessionState', session.state)

    if (sessionState === 'unauthenticated') {
      return (
        <div>
          <NotyList style={{ zIndex: '2' }} />
          <Login />
        </div>
      )
    }

    return (
      <div>
        <NotyList style={{ zIndex: '2' }} />
        <AuthenticatedLayout />
      </div>
    )
  },
})

const AuthenticatedLayout = Shade({
  customElementName: 'shade-authenticated-layout',
  render: ({ injector, useDisposable }) => {
    const serviceUrl = new URL(environmentOptions.serviceUrl)
    const syncProtocol = serviceUrl.protocol === 'https:' ? 'wss:' : 'ws:'
    const syncWsUrl = `${syncProtocol}//${serviceUrl.host}/api/ws`

    const authenticatedInjector = useDisposable('authenticatedInjector', () => {
      const child = injector.createChild()
      child.setExplicitInstance(new EntitySyncService({ wsUrl: syncWsUrl }), EntitySyncService)
      return child
    })

    return (
      <PageLayout
        appBar={{
          variant: 'permanent',
          component: <Header title="StackCraft" injector={authenticatedInjector} />,
        }}
        drawer={{
          left: {
            variant: 'collapsible',
            width: '220px',
            component: <Sidebar injector={authenticatedInjector} />,
            collapseOnBreakpoint: 'md',
          },
        }}
      >
        <Body injector={authenticatedInjector} style={{ width: '100%', height: '100%', overflow: 'auto' }} />
      </PageLayout>
    )
  },
})

const LazyInstallerPage = Shade({
  customElementName: 'shade-lazy-installer',
  css: {
    display: 'block',
    width: '100%',
    height: '100%',
  },
  render: ({ useState }) => {
    const [loaded, setLoaded] = useState('loaded', false)
    const [Component, setComponent] = useState<JSX.Element | null>('component', null)

    if (!loaded) {
      void import('../pages/installer/index.js').then(({ InstallerPage }) => {
        setComponent(<InstallerPage />)
        setLoaded(true)
      })
      return <Init />
    }

    return Component ?? <Init />
  },
})
