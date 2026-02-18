import type { CorsOptions } from '@furystack/rest-service'

export const getCorsOptions = (): CorsOptions => ({
  credentials: true,
  origins: ['http://localhost:8080'],
  headers: ['cache', 'content-type'],
  methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE'],
})
