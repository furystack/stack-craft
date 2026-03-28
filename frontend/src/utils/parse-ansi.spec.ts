import { describe, expect, it } from 'vitest'

import { parseAnsi } from './parse-ansi.js'

describe('parseAnsi', () => {
  it('should return a single segment for plain text', () => {
    const result = parseAnsi('hello world')
    expect(result).toEqual([{ text: 'hello world', style: {} }])
  })

  it('should return a single segment for an empty string', () => {
    const result = parseAnsi('')
    expect(result).toEqual([{ text: '', style: {} }])
  })

  it('should parse a single foreground color', () => {
    const result = parseAnsi('\x1b[31mred text\x1b[0m')
    expect(result).toEqual([{ text: 'red text', style: { color: '#ff5f56' } }])
  })

  it('should parse bold text', () => {
    const result = parseAnsi('\x1b[1mbold\x1b[0m normal')
    expect(result).toEqual([
      { text: 'bold', style: { fontWeight: 'bold' } },
      { text: ' normal', style: {} },
    ])
  })

  it('should parse dim text', () => {
    const result = parseAnsi('\x1b[2mdim\x1b[0m')
    expect(result).toEqual([{ text: 'dim', style: { opacity: '0.7' } }])
  })

  it('should parse italic text', () => {
    const result = parseAnsi('\x1b[3mitalic\x1b[0m')
    expect(result).toEqual([{ text: 'italic', style: { fontStyle: 'italic' } }])
  })

  it('should parse underlined text', () => {
    const result = parseAnsi('\x1b[4munderline\x1b[0m')
    expect(result).toEqual([{ text: 'underline', style: { textDecoration: 'underline' } }])
  })

  it('should parse stacked codes (bold + red)', () => {
    const result = parseAnsi('\x1b[1;31mERROR\x1b[0m: something')
    expect(result).toEqual([
      { text: 'ERROR', style: { fontWeight: 'bold', color: '#ff5f56' } },
      { text: ': something', style: {} },
    ])
  })

  it('should handle reset in the middle of a line', () => {
    const result = parseAnsi('\x1b[32mgreen\x1b[0m normal \x1b[34mblue\x1b[0m')
    expect(result).toEqual([
      { text: 'green', style: { color: '#5af78e' } },
      { text: ' normal ', style: {} },
      { text: 'blue', style: { color: '#57c7ff' } },
    ])
  })

  it('should parse bright foreground colors', () => {
    const result = parseAnsi('\x1b[91mbright red\x1b[0m')
    expect(result).toEqual([{ text: 'bright red', style: { color: '#ff6e67' } }])
  })

  it('should parse background colors', () => {
    const result = parseAnsi('\x1b[41mred bg\x1b[0m')
    expect(result).toEqual([{ text: 'red bg', style: { backgroundColor: '#ff5f56' } }])
  })

  it('should parse bright background colors', () => {
    const result = parseAnsi('\x1b[101mbright red bg\x1b[0m')
    expect(result).toEqual([{ text: 'bright red bg', style: { backgroundColor: '#ff6e67' } }])
  })

  it('should parse 256-color foreground', () => {
    const result = parseAnsi('\x1b[38;5;196mcolor\x1b[0m')
    expect(result).toHaveLength(1)
    expect(result[0].text).toBe('color')
    expect(result[0].style.color).toBeDefined()
  })

  it('should parse 256-color background', () => {
    const result = parseAnsi('\x1b[48;5;21mbg\x1b[0m')
    expect(result).toHaveLength(1)
    expect(result[0].text).toBe('bg')
    expect(result[0].style.backgroundColor).toBeDefined()
  })

  it('should parse 24-bit RGB foreground', () => {
    const result = parseAnsi('\x1b[38;2;255;128;0mrgb\x1b[0m')
    expect(result).toEqual([{ text: 'rgb', style: { color: 'rgb(255, 128, 0)' } }])
  })

  it('should parse 24-bit RGB background', () => {
    const result = parseAnsi('\x1b[48;2;0;128;255mrgb bg\x1b[0m')
    expect(result).toEqual([{ text: 'rgb bg', style: { backgroundColor: 'rgb(0, 128, 255)' } }])
  })

  it('should handle bare ESC[ (no parameters) as reset', () => {
    const result = parseAnsi('\x1b[31mred\x1b[mnormal')
    expect(result).toEqual([
      { text: 'red', style: { color: '#ff5f56' } },
      { text: 'normal', style: {} },
    ])
  })

  it('should handle color accumulation across codes', () => {
    const result = parseAnsi('\x1b[1m\x1b[31mbold red\x1b[0m')
    expect(result).toEqual([{ text: 'bold red', style: { fontWeight: 'bold', color: '#ff5f56' } }])
  })

  it('should handle specific reset codes', () => {
    const result = parseAnsi('\x1b[1;3;31mstyled\x1b[22mnot bold\x1b[0m')
    expect(result).toEqual([
      { text: 'styled', style: { fontWeight: 'bold', fontStyle: 'italic', color: '#ff5f56' } },
      { text: 'not bold', style: { fontStyle: 'italic', color: '#ff5f56' } },
    ])
  })

  it('should handle default foreground/background reset codes', () => {
    const result = parseAnsi('\x1b[31;42mcolored\x1b[39mno fg\x1b[49mno bg')
    expect(result).toEqual([
      { text: 'colored', style: { color: '#ff5f56', backgroundColor: '#5af78e' } },
      { text: 'no fg', style: { backgroundColor: '#5af78e' } },
      { text: 'no bg', style: {} },
    ])
  })

  it('should gracefully ignore unknown codes', () => {
    const result = parseAnsi('\x1b[999mtext\x1b[0m')
    expect(result).toEqual([{ text: 'text', style: {} }])
  })

  it('should handle text before first escape code', () => {
    const result = parseAnsi('prefix \x1b[31mred\x1b[0m')
    expect(result).toEqual([
      { text: 'prefix ', style: {} },
      { text: 'red', style: { color: '#ff5f56' } },
    ])
  })
})
