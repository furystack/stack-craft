import { createComponent, Shade } from '@furystack/shades'
import { getTextColor, ThemeProviderService } from '@furystack/shades-common-components'

import ghLight from './gh-light.png'
import ghDark from './gh-dark.png'

type GithubLogoProps = Omit<Partial<HTMLImageElement>, 'style' | 'src' | 'alt'> & {
  style?: Partial<CSSStyleDeclaration> | undefined
}

export const GithubLogo = Shade<GithubLogoProps>({
  customElementName: 'github-logo',
  css: {
    display: 'inline-block',
    '& img': {
      transition: 'opacity 0.2s ease',
    },
    '&:hover img': {
      opacity: '0.8',
    },
  },
  render: ({ props, useDisposable, useState, injector }) => {
    const themeProvider = injector.get(ThemeProviderService)
    const [theme, setTheme] = useState('themeName', getTextColor(themeProvider.theme.background.paper, 'light', 'dark'))
    useDisposable('themeChange', () =>
      themeProvider.subscribe('themeChanged', () => {
        const value = getTextColor(themeProvider.theme.background.paper, 'light', 'dark')
        setTheme(value)
      }),
    )
    return <img {...props} src={theme === 'dark' ? ghLight : ghDark} alt="gh-logo" />
  },
})
