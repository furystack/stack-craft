/* eslint-disable @typescript-eslint/ban-ts-comment */
import { createComponent, Shade } from '@furystack/shades'
import { ThemeProviderService } from '@furystack/shades-common-components'
// @ts-ignore
import ghLight from './gh-light.png'
// @ts-ignore
import ghDark from './gh-dark.png'

type GithubLogoProps = Omit<Partial<HTMLImageElement>, 'style' | 'src' | 'alt'> & {
  style?: Partial<CSSStyleDeclaration> | undefined
}

export const GithubLogo = Shade<GithubLogoProps>({
  shadowDomName: 'github-logo',
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
    const themeProvider = injector.getInstance(ThemeProviderService)
    const [theme, setTheme] = useState(
      'themeName',
      themeProvider.getTextColor(themeProvider.theme.background.paper, 'light', 'dark'),
    )
    useDisposable('themeChange', () =>
      themeProvider.subscribe('themeChanged', () => {
        const value = themeProvider.getTextColor(themeProvider.theme.background.paper, 'light', 'dark')
        setTheme(value)
      }),
    )
    return <img {...props} src={theme === 'dark' ? ghLight : ghDark} alt="gh-logo" />
  },
})
