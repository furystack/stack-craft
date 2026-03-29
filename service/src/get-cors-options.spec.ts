import { describe, expect, it } from 'vitest'
import { getCorsOptions } from './get-cors-options.js'

describe('getCorsOptions', () => {
  it('should return default origins when CORS_ORIGINS is not set', () => {
    const options = getCorsOptions({})
    expect(options.origins).toEqual(['http://localhost:8080'])
  })

  it('should parse comma-separated CORS_ORIGINS', () => {
    const options = getCorsOptions({ CORS_ORIGINS: 'https://app.example.com,https://admin.example.com' })
    expect(options.origins).toEqual(['https://app.example.com', 'https://admin.example.com'])
  })

  it('should trim whitespace from origins', () => {
    const options = getCorsOptions({ CORS_ORIGINS: '  https://a.com , https://b.com  ' })
    expect(options.origins).toEqual(['https://a.com', 'https://b.com'])
  })

  it('should filter out empty strings', () => {
    const options = getCorsOptions({ CORS_ORIGINS: 'https://a.com,,, https://b.com,' })
    expect(options.origins).toEqual(['https://a.com', 'https://b.com'])
  })

  it('should always include credentials: true', () => {
    expect(getCorsOptions({}).credentials).toBe(true)
    expect(getCorsOptions({ CORS_ORIGINS: 'https://x.com' }).credentials).toBe(true)
  })

  it('should include expected headers', () => {
    const options = getCorsOptions({})
    expect(options.headers).toEqual(['cache', 'content-type'])
  })

  it('should include expected methods', () => {
    const options = getCorsOptions({})
    expect(options.methods).toEqual(['GET', 'POST', 'PATCH', 'PUT', 'DELETE'])
  })
})
