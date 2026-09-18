import { createComponent, LazyLoad, Shade } from '@furystack/shades'
import { cssVariableTheme, Loader } from '@furystack/shades-common-components'
import type { MonacoEditorProps } from '@furystack/shades-monaco'

type LazyMonacoEditorProps = {
  value?: string
  language: string
  readOnly?: boolean
  schemaInfo?: MonacoEditorProps['schema']
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
  render: ({ props }) => {
    return (
      <LazyLoad
        /*api={{
          value: props.value ?? '',
          language: props.language,
          readOnly: props.readOnly,
          automaticLayout: true,
          theme: monacoTheme.data,
          schemaInfo: props.schemaInfo,
          onValueChange: props.onValueChange,
        }}*/
        component={async () => {
          const { MonacoEditor } = await import('@furystack/shades-monaco')
          return (
            <MonacoEditor
              value={props.value || ''}
              options={{}}
              onValueChange={props.onValueChange}
              schema={props.schemaInfo}
            />
          )
        }}
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
