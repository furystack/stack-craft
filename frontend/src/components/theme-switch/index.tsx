import { createComponent, Shade } from '@furystack/shades'
import type { ButtonProps } from '@furystack/shades-common-components'
import {
  Button,
  defaultDarkTheme,
  defaultLightTheme,
  getCssVariable,
  ThemeProviderService,
} from '@furystack/shades-common-components'

export const ThemeSwitch = Shade<Omit<ButtonProps, 'onclick'>>({
  shadowDomName: 'theme-switch',
  render: ({ props, injector, useState, useDisposable }) => {
    const themeProvider = injector.getInstance(ThemeProviderService)
    const [theme, setTheme] = useState<'light' | 'dark'>(
      'theme',
      getCssVariable(themeProvider.theme.background.default) === defaultDarkTheme.background.default ? 'dark' : 'light',
    )

    useDisposable('traceThemeChange', () =>
      themeProvider.subscribe('themeChanged', (newTheme) => {
        setTheme(newTheme.name === 'dark' ? 'dark' : 'light')
      }),
    )

    return (
      <Button
        {...props}
        onclick={() => {
          themeProvider.setAssignedTheme(theme === 'dark' ? defaultLightTheme : defaultDarkTheme)
        }}
      >
        {theme === 'dark' ? '☀️' : '🌜'}
      </Button>
    )
  },
})
