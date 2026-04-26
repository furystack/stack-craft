import { createComponent, Shade } from '@furystack/shades'
import { cssVariableTheme, NotyList, PageLayout, ThemeProviderService } from '@furystack/shades-common-components'
import { Init } from '../../pages/init.js'
import { Login } from '../../pages/login.js'
import { AppEntitySyncService } from '../../services/entity-sync.js'
import { InstallService } from '../../services/install-service.js'
import { SessionService } from '../../services/session.js'
import { applyTheme, DEFAULT_THEME_KEY, THEME_STORAGE_KEY } from '../../services/theme-registry.js'
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
  render: ({ injector, useObservable, useStoredState }) => {
    const [themeKey] = useStoredState<string>(THEME_STORAGE_KEY, DEFAULT_THEME_KEY)
    const themeProvider = injector.get(ThemeProviderService)
    void applyTheme(themeKey, themeProvider)

    const installService = injector.get(InstallService)
    const [installStatus] = useObservable('installStatus', installService.getServiceStatusAsObservable())

    if (installStatus.status === 'loading') {
      return <Init />
    }

    if (installStatus.status === 'failed') {
      return (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            height: '100%',
            gap: '16px',
            color: cssVariableTheme.text.primary,
          }}
        >
          <h2 style={{ margin: '0' }}>Unable to Connect</h2>
          <p style={{ color: cssVariableTheme.text.secondary, maxWidth: '400px', textAlign: 'center' }}>
            Could not reach the StackCraft service. Please check that the backend is running and try again.
          </p>
          <button
            onclick={() => {
              void installService.getServiceStatus()
            }}
            style={{
              padding: '8px 24px',
              cursor: 'pointer',
              borderRadius: '4px',
              border: 'none',
              background: cssVariableTheme.palette.primary.main,
              color: cssVariableTheme.text.primary,
              fontSize: '14px',
            }}
          >
            Retry
          </button>
        </div>
      )
    }

    if (installStatus.value.state === 'needsInstall') {
      return (
        <div>
          <NotyList style={{ zIndex: '2' }} />
          <LazyInstallerPage />
        </div>
      )
    }

    const session = injector.get(SessionService)
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
        <NotyList style={{ zIndex: '2' }} aria-live="polite" />
        <AuthenticatedLayout />
      </div>
    )
  },
})

const AuthenticatedLayout = Shade({
  customElementName: 'shade-authenticated-layout',
  render: ({ injector }) => {
    // Eagerly resolve the per-app sync service so its WebSocket connection
    // opens once the layout mounts. Disposal is owned by the injector.
    injector.get(AppEntitySyncService)

    return (
      <PageLayout
        appBar={{
          variant: 'permanent',
          component: <Header title="StackCraft" />,
        }}
        drawer={{
          left: {
            variant: 'collapsible',
            width: '220px',
            component: <Sidebar />,
            collapseOnBreakpoint: 'md',
          },
        }}
      >
        <Body style={{ width: '100%', height: '100%', overflow: 'auto' }} />
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
      void import('../../pages/installer/index.js').then(({ InstallerPage }) => {
        setComponent(<InstallerPage />)
        setLoaded(true)
      })
      return <Init />
    }

    return Component ?? <Init />
  },
})
