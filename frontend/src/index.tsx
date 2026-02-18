/** ToDo: Main entry point */
import { EntitySyncService } from '@furystack/entity-sync-client'
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

const serviceUrl = new URL(environmentOptions.serviceUrl)
const syncProtocol = serviceUrl.protocol === 'https:' ? 'wss:' : 'ws:'
const syncWsUrl = `${syncProtocol}//${serviceUrl.host}/api/ws`
shadeInjector.setExplicitInstance(new EntitySyncService({ wsUrl: syncWsUrl }))

shadeInjector.getInstance(SessionService)

shadeInjector.getInstance(ThemeProviderService).setAssignedTheme(defaultDarkTheme)

const rootElement: HTMLDivElement = document.getElementById('root') as HTMLDivElement

initializeShadeRoot({
  injector: shadeInjector,
  rootElement,
  jsxElement: <Layout />,
})
