import { createComponent, LocationService, Shade } from '@furystack/shades'
import type { ButtonProps } from '@furystack/shades-common-components'
import { Button, cssVariableTheme, ThemeProviderService, Tooltip } from '@furystack/shades-common-components'

import { applyTheme, DEFAULT_THEME_KEY, THEME_STORAGE_KEY } from '../../services/theme-registry.js'

export const ThemeSwitch = Shade<Omit<ButtonProps, 'onclick'>>({
  customElementName: 'theme-switch',
  render: ({ props, injector, useStoredState, useDisposable }) => {
    const themeProvider = injector.getInstance(ThemeProviderService)
    const locationService = injector.getInstance(LocationService)
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
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px' }}>
        <Tooltip title={isDark ? 'Switch to light theme' : 'Switch to dark theme'}>
          <Button
            {...props}
            aria-label={isDark ? 'Switch to light theme' : 'Switch to dark theme'}
            onclick={() => {
              const newKey = isDark ? 'light' : 'dark'
              setThemeKey(newKey)
              void applyTheme(newKey, themeProvider)
            }}
          >
            {isDark ? '☀️' : '🌜'}
          </Button>
        </Tooltip>
        <button
          type="button"
          onclick={() => locationService.navigate('/settings')}
          style={{
            fontSize: cssVariableTheme.typography.fontSize.sm,
            color: cssVariableTheme.palette.primary.main,
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            padding: '0',
            textDecoration: 'underline',
          }}
        >
          More themes
        </button>
      </div>
    )
  },
})
