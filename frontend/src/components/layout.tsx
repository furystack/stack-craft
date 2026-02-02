import { createComponent, Shade } from '@furystack/shades'
import { ThemeProviderService } from '@furystack/shades-common-components'
import { Body } from './body.js'
import { Header } from './header.js'

export const Layout = Shade({
  shadowDomName: 'shade-app-layout',
  css: {
    position: 'fixed',
    top: '0',
    left: '0',
    width: '100%',
    height: '100%',
    display: 'flex',
    flexDirection: 'column',
    lineHeight: '1.6',
    overflow: 'hidden',
    padding: '0',
    margin: '0',
  },
  render: ({ injector }) => {
    return (
      <div
        id="Layout"
        style={{
          backgroundColor: injector.getInstance(ThemeProviderService).theme.background.default,
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <Header title="🧩 Stack Craft" links={[]} />
        <Body style={{ width: '100%', height: '100%', overflow: 'auto' }} />
      </div>
    )
  },
})
