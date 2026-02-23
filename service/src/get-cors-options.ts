import type { CorsOptions } from '@furystack/rest-service'

const DEFAULT_ORIGINS = ['http://localhost:8080']

export const getCorsOptions = (env = process.env): CorsOptions => ({
  credentials: true,
  origins: env.CORS_ORIGINS
    ? env.CORS_ORIGINS.split(',')
        .map((o) => o.trim())
        .filter((o) => o.length > 0)
    : DEFAULT_ORIGINS,
  headers: ['cache', 'content-type'],
  methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE'],
})
