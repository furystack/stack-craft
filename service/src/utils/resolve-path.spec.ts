import { homedir } from 'os'
import { resolve } from 'path'
import { describe, expect, it } from 'vitest'

import { resolvePath } from './resolve-path.js'

describe('resolvePath', () => {
  it('should expand ~ to the home directory', () => {
    const result = resolvePath('~/my-project')
    expect(result).toBe(resolve(homedir(), 'my-project'))
  })

  it('should resolve absolute paths unchanged', () => {
    const result = resolvePath('/opt/data')
    expect(result).toBe(resolve('/opt/data'))
  })

  it('should resolve relative paths against cwd', () => {
    const result = resolvePath('some/relative/path')
    expect(result).toBe(resolve('some/relative/path'))
  })

  it('should handle just ~ as the home directory', () => {
    const result = resolvePath('~')
    expect(result).toBe(resolve(homedir()))
  })

  it('should not expand ~ in the middle of a path', () => {
    const result = resolvePath('/opt/my~dir')
    expect(result).toBe(resolve('/opt/my~dir'))
  })
})
