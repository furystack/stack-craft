import { createComponent, Shade } from '@furystack/shades'
import { cssVariableTheme } from '@furystack/shades-common-components'

import type { AnsiStyle } from '../../utils/parse-ansi.js'
import { parseAnsi } from '../../utils/parse-ansi.js'

const URL_REGEX = /(https?:\/\/[^\s)]+)/g

const renderTextWithLinks = (text: string, style: AnsiStyle) => {
  const parts: JSX.Element[] = []
  let lastIndex = 0

  URL_REGEX.lastIndex = 0
  let match = URL_REGEX.exec(text)

  while (match !== null) {
    const before = text.slice(lastIndex, match.index)
    if (before) {
      parts.push(<span style={style}>{before}</span>)
    }

    const url = match[1]
    parts.push(
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        style={{
          ...style,
          color: style.color ?? cssVariableTheme.palette.primary.main,
          textDecoration: 'underline',
          cursor: 'pointer',
        }}
      >
        {url}
      </a>,
    )

    lastIndex = match.index + match[0].length
    match = URL_REGEX.exec(text)
  }

  const remaining = text.slice(lastIndex)
  if (remaining) {
    parts.push(<span style={style}>{remaining}</span>)
  }

  return parts
}

type LogLineProps = {
  line: string
}

export const LogLine = Shade<LogLineProps>({
  customElementName: 'shade-log-line',
  render: ({ props }) => {
    const segments = parseAnsi(props.line)

    return <span>{segments.flatMap((segment) => renderTextWithLinks(segment.text, segment.style))}</span>
  },
})
