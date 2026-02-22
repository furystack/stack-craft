export type AnsiStyle = {
  color?: string
  backgroundColor?: string
  fontWeight?: 'bold'
  fontStyle?: 'italic'
  textDecoration?: 'underline'
  opacity?: string
}

export type AnsiSegment = {
  text: string
  style: AnsiStyle
}

const STANDARD_COLORS: Record<number, string> = {
  0: '#000000',
  1: '#ff5f56',
  2: '#5af78e',
  3: '#f3f99d',
  4: '#57c7ff',
  5: '#ff6ac1',
  6: '#9aedfe',
  7: '#f1f1f0',
}

const BRIGHT_COLORS: Record<number, string> = {
  0: '#686868',
  1: '#ff6e67',
  2: '#5af78e',
  3: '#f4f99d',
  4: '#6871ff',
  5: '#ff77ff',
  6: '#60fdff',
  7: '#ffffff',
}

const ANSI_256_COLORS: string[] = (() => {
  const colors: string[] = []

  // 0-7: standard
  for (let i = 0; i < 8; i++) {
    colors.push(STANDARD_COLORS[i])
  }
  // 8-15: bright
  for (let i = 0; i < 8; i++) {
    colors.push(BRIGHT_COLORS[i])
  }
  // 16-231: 6x6x6 color cube
  for (let r = 0; r < 6; r++) {
    for (let g = 0; g < 6; g++) {
      for (let b = 0; b < 6; b++) {
        const rv = r === 0 ? 0 : 55 + r * 40
        const gv = g === 0 ? 0 : 55 + g * 40
        const bv = b === 0 ? 0 : 55 + b * 40
        colors.push(
          `#${rv.toString(16).padStart(2, '0')}${gv.toString(16).padStart(2, '0')}${bv.toString(16).padStart(2, '0')}`,
        )
      }
    }
  }
  // 232-255: grayscale ramp
  for (let i = 0; i < 24; i++) {
    const v = 8 + i * 10
    colors.push(
      `#${v.toString(16).padStart(2, '0')}${v.toString(16).padStart(2, '0')}${v.toString(16).padStart(2, '0')}`,
    )
  }

  return colors
})()

const applySgrCodes = (codes: number[], style: AnsiStyle): AnsiStyle => {
  const next = { ...style }
  let i = 0

  while (i < codes.length) {
    const code = codes[i]

    if (code === 0) {
      return {}
    } else if (code === 1) {
      next.fontWeight = 'bold'
    } else if (code === 2) {
      next.opacity = '0.7'
    } else if (code === 3) {
      next.fontStyle = 'italic'
    } else if (code === 4) {
      next.textDecoration = 'underline'
    } else if (code === 22) {
      delete next.fontWeight
      delete next.opacity
    } else if (code === 23) {
      delete next.fontStyle
    } else if (code === 24) {
      delete next.textDecoration
    } else if (code === 39) {
      delete next.color
    } else if (code === 49) {
      delete next.backgroundColor
    } else if (code >= 30 && code <= 37) {
      next.color = STANDARD_COLORS[code - 30]
    } else if (code >= 40 && code <= 47) {
      next.backgroundColor = STANDARD_COLORS[code - 40]
    } else if (code >= 90 && code <= 97) {
      next.color = BRIGHT_COLORS[code - 90]
    } else if (code >= 100 && code <= 107) {
      next.backgroundColor = BRIGHT_COLORS[code - 100]
    } else if (code === 38 || code === 48) {
      const target = code === 38 ? 'color' : 'backgroundColor'
      const mode = codes[i + 1]
      if (mode === 5 && i + 2 < codes.length) {
        const colorIndex = codes[i + 2]
        if (colorIndex >= 0 && colorIndex < 256) {
          next[target] = ANSI_256_COLORS[colorIndex]
        }
        i += 2
      } else if (mode === 2 && i + 4 < codes.length) {
        const r = codes[i + 2]
        const g = codes[i + 3]
        const b = codes[i + 4]
        next[target] = `rgb(${r}, ${g}, ${b})`
        i += 4
      }
    }

    i++
  }

  return next
}

const ANSI_REGEX = /\x1b\[([0-9;]*)m/g

/**
 * Parses a string containing ANSI SGR escape sequences into styled segments.
 */
export const parseAnsi = (input: string): AnsiSegment[] => {
  const segments: AnsiSegment[] = []
  let currentStyle: AnsiStyle = {}
  let lastIndex = 0

  ANSI_REGEX.lastIndex = 0
  let match = ANSI_REGEX.exec(input)

  while (match !== null) {
    const textBefore = input.slice(lastIndex, match.index)
    if (textBefore) {
      segments.push({ text: textBefore, style: { ...currentStyle } })
    }

    const rawCodes = match[1]
    const codes = rawCodes === '' ? [0] : rawCodes.split(';').map(Number)
    currentStyle = applySgrCodes(codes, currentStyle)

    lastIndex = match.index + match[0].length
    match = ANSI_REGEX.exec(input)
  }

  const remaining = input.slice(lastIndex)
  if (remaining) {
    segments.push({ text: remaining, style: { ...currentStyle } })
  }

  if (segments.length === 0) {
    segments.push({ text: input, style: {} })
  }

  return segments
}
