/** ToDo: Main entry point */
import { Injector } from '@furystack/inject'
import { getLogger, useLogging, VerboseConsoleLogger } from '@furystack/logging'
import { createComponent, initializeShadeRoot } from '@furystack/shades'
import { defaultDarkTheme, ThemeProviderService } from '@furystack/shades-common-components'
import { Layout } from './components/layout.js'
import { environmentOptions } from './environment-options.js'
import { SessionService } from './services/session.js'

const shadeInjector = new Injector()

useLogging(shadeInjector, VerboseConsoleLogger)

void getLogger(shadeInjector).withScope('Startup').verbose({
  message: 'Initializing Shade Frontend...',
  data: { environmentOptions },
})

shadeInjector.getInstance(SessionService)

shadeInjector.getInstance(ThemeProviderService).setAssignedTheme(defaultDarkTheme)

const rootElement: HTMLDivElement = document.getElementById('root') as HTMLDivElement

initializeShadeRoot({
  injector: shadeInjector,
  rootElement,
  jsxElement: <Layout />,
})
