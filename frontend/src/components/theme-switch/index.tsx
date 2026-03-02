import { createComponent, Shade } from '@furystack/shades'
import type { ButtonProps } from '@furystack/shades-common-components'
import { Button, ThemeProviderService } from '@furystack/shades-common-components'

import { applyTheme, DEFAULT_THEME_KEY, THEME_STORAGE_KEY } from '../../services/theme-registry.js'

export const ThemeSwitch = Shade<Omit<ButtonProps, 'onclick'>>({
  shadowDomName: 'theme-switch',
  render: ({ props, injector, useStoredState, useDisposable }) => {
    const themeProvider = injector.getInstance(ThemeProviderService)
    const [themeKey, setThemeKey] = useStoredState<string>(THEME_STORAGE_KEY, DEFAULT_THEME_KEY)

    const isDark = themeKey !== 'light'

    useDisposable('traceThemeChange', () =>
      themeProvider.subscribe('themeChanged', (newTheme) => {
        const newKey = newTheme.name === 'default-light-theme' ? 'light' : themeKey
        if (newKey !== themeKey) {
          setThemeKey(newKey)
        }
      }),
    )

    return (
      <Button
        {...props}
        onclick={() => {
          const newKey = isDark ? 'light' : 'dark'
          setThemeKey(newKey)
          void applyTheme(newKey, themeProvider)
        }}
      >
        {isDark ? '☀️' : '🌜'}
      </Button>
    )
  },
})
