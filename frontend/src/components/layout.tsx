import { createComponent, Shade } from '@furystack/shades'
import { cssVariableTheme, NotyList, PageLayout } from '@furystack/shades-common-components'
import { InstallService } from '../services/install-service.js'
import { Body } from './body.js'
import { Header } from './header.js'
import { Init } from '../pages/init.js'

export const Layout = Shade({
  shadowDomName: 'shade-app-layout',
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
  render: ({ injector, useState }) => {
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

    return (
      <div>
        <NotyList style={{ zIndex: '2' }} />
        <PageLayout
          appBar={{
            variant: 'permanent',
            component: <Header title="StackCraft" links={[]} />,
          }}
        >
          <Body style={{ width: '100%', height: '100%', overflow: 'auto' }} />
        </PageLayout>
      </div>
    )
  },
})

const LazyInstallerPage = Shade({
  shadowDomName: 'shade-lazy-installer',
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
