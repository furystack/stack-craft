import { Injector } from '@furystack/inject'
import { getLogger, useLogging, VerboseConsoleLogger } from '@furystack/logging'
import { createComponent, initializeShadeRoot } from '@furystack/shades'
import { ThemeProviderService } from '@furystack/shades-common-components'

import { applyTheme, DEFAULT_THEME_KEY, THEME_STORAGE_KEY } from './services/theme-registry.js'
import { Layout } from './components/layout/index.js'
import { environmentOptions } from './environment-options.js'
import { SessionService } from './services/session.js'

const shadeInjector = new Injector()

useLogging(shadeInjector, VerboseConsoleLogger)

void getLogger(shadeInjector).withScope('Startup').verbose({
  message: 'Initializing Shade Frontend...',
  data: { environmentOptions },
})

shadeInjector.get(SessionService)

const storedValue = localStorage.getItem(THEME_STORAGE_KEY)
const savedThemeKey = storedValue ? (JSON.parse(storedValue) as string) : DEFAULT_THEME_KEY
void applyTheme(savedThemeKey, shadeInjector.get(ThemeProviderService))

const rootElement: HTMLDivElement = document.getElementById('root') as HTMLDivElement

initializeShadeRoot({
  injector: shadeInjector,
  rootElement,
  jsxElement: <Layout />,
})
