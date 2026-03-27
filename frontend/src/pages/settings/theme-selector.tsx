import { createComponent, Shade } from '@furystack/shades'
import { NotyService, Paper, Select, ThemeProviderService } from '@furystack/shades-common-components'

import { applyTheme, DEFAULT_THEME_KEY, themeEntries, THEME_STORAGE_KEY } from '../../services/theme-registry.js'

export const ThemeSelector = Shade({
  shadowDomName: 'shade-theme-selector',
  render: ({ injector, useStoredState }) => {
    const [themeKey, setThemeKey] = useStoredState<string>(THEME_STORAGE_KEY, DEFAULT_THEME_KEY)
    const themeProvider = injector.getInstance(ThemeProviderService)

    return (
      <Paper elevation={1} style={{ padding: '16px', marginBottom: '16px' }}>
        <h3 style={{ margin: '0 0 12px 0' }}>Theme</h3>
        <Select
          labelTitle="Select a theme"
          variant="outlined"
          showSearch
          value={themeKey}
          options={themeEntries.map((entry) => ({ value: entry.key, label: entry.label }))}
          onValueChange={(newKey) => {
            setThemeKey(newKey)
            void applyTheme(newKey, themeProvider)

            const entry = themeEntries.find((e) => e.key === newKey)
            if (entry?.quote) {
              injector.getInstance(NotyService).emit('onNotyAdded', {
                title: entry.label,
                body: entry.quote,
                type: 'info',
              })
            }
          }}
        />
      </Paper>
    )
  },
})
