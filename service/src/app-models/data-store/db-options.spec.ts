import { describe, expect, it, afterEach } from 'vitest'

import { getDbOptions } from './db-options.js'

describe('getDbOptions', () => {
  const originalEnv = { ...process.env }

  afterEach(() => {
    process.env = { ...originalEnv }
  })

  it('should throw when DATABASE_URL is not set', () => {
    delete process.env.DATABASE_URL

    expect(() => getDbOptions()).toThrow('DATABASE_URL environment variable is required')
  })

  it('should parse a full postgres URL correctly', () => {
    process.env.DATABASE_URL = 'postgres://admin:s3cret@db.example.com:5433/mydb'

    const opts = getDbOptions()

    expect(opts).toMatchObject({
      dialect: 'postgres',
      host: 'db.example.com',
      port: 5433,
      database: 'mydb',
      username: 'admin',
      password: 's3cret',
      logging: false,
    })
  })

  it('should default port to 5432 when not specified in the URL', () => {
    process.env.DATABASE_URL = 'postgres://user:pass@localhost/testdb'

    const opts = getDbOptions()

    expect(opts.port).toBe(5432)
  })

  it('should decode percent-encoded username and password', () => {
    process.env.DATABASE_URL = 'postgres://my%40user:p%23ss@host:5432/db'

    const opts = getDbOptions()

    expect(opts.username).toBe('my@user')
    expect(opts.password).toBe('p#ss')
  })

  it('should strip the leading slash from the database name', () => {
    process.env.DATABASE_URL = 'postgres://u:p@host:5432/my_database'

    const opts = getDbOptions()

    expect(opts.database).toBe('my_database')
  })
})
