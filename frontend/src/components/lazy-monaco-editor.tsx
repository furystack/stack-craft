import { createComponent, Shade } from '@furystack/shades'
import { cssVariableTheme, Loader, ThemeProviderService } from '@furystack/shades-common-components'
import { MicroFrontend } from '@furystack/shades-mfe'

import { ObservableValue } from '@furystack/utils'
import { createMonacoTheme } from './create-monaco-theme.js'

const MONACO_MFE_URL = '/monaco-mfe/index.js'

/**
 * Must stay in sync with `SchemaInfo` in `monaco-mfe/src/schema.ts`.
 */
export type EditorSchemaInfo = {
  schemaName: string
  jsonSchema: Record<string, unknown>
}

type LazyMonacoEditorProps = {
  value?: string
  language: string
  readOnly?: boolean
  schemaInfo?: EditorSchemaInfo
  onValueChange?: (value: string) => void
  style?: Partial<CSSStyleDeclaration>
}

export const LazyMonacoEditor = Shade<LazyMonacoEditorProps>({
  customElementName: 'lazy-monaco-editor',
  css: {
    display: 'block',
    height: '100%',
    width: '100%',
    position: 'relative',
  },
  render: ({ props, injector, useObservable, useDisposable }) => {
    const themeProvider = injector.getInstance(ThemeProviderService)

    const monacoThemeObs = useDisposable(
      'monacoThemeObs',
      () => new ObservableValue(createMonacoTheme(themeProvider.getAssignedTheme())),
    )

    const [monacoTheme] = useObservable('monacoTheme', monacoThemeObs)

    useDisposable('themeChange', () => {
      return themeProvider.subscribe('themeChanged', (newTheme) => {
        monacoThemeObs.setValue(createMonacoTheme(newTheme))
      })
    })

    return (
      <MicroFrontend
        api={{
          value: props.value ?? '',
          language: props.language,
          readOnly: props.readOnly,
          automaticLayout: true,
          theme: monacoTheme.data,
          schemaInfo: props.schemaInfo,
          onValueChange: props.onValueChange,
        }}
        loaderCallback={() => import(/* @vite-ignore */ MONACO_MFE_URL)}
        loader={
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              height: '100%',
              opacity: '0.6',
            }}
          >
            <Loader style={{ width: '48px', height: '48px' }} />
          </div>
        }
        error={(_error, retry) => (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              height: '100%',
              gap: '8px',
              color: cssVariableTheme.palette.error.main,
            }}
          >
            <span>Failed to load editor</span>
            {retry ? (
              <button type="button" onclick={() => void retry()}>
                Retry
              </button>
            ) : null}
          </div>
        )}
      />
    )
  },
})
