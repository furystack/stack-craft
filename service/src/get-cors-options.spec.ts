import { describe, expect, it } from 'vitest'
import { getCorsOptions } from './get-cors-options.js'

describe('getCorsOptions', () => {
  it('should return CORS options with credentials enabled', () => {
    const options = getCorsOptions({})
    expect(options.credentials).toBe(true)
  })

  it('should allow localhost:8080 as default origin', () => {
    const options = getCorsOptions({})
    expect(options.origins).toContain('http://localhost:8080')
  })

  it('should use CORS_ORIGINS env var when set', () => {
    const options = getCorsOptions({ CORS_ORIGINS: 'https://app.example.com, https://admin.example.com' })
    expect(options.origins).toEqual(['https://app.example.com', 'https://admin.example.com'])
  })

  it('should include required HTTP methods', () => {
    const options = getCorsOptions({})
    expect(options.methods).toEqual(expect.arrayContaining(['GET', 'POST', 'PATCH', 'DELETE']))
  })

  it('should include content-type in allowed headers', () => {
    const options = getCorsOptions({})
    expect(options.headers).toContain('content-type')
  })
})
