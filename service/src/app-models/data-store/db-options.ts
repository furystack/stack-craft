import type { Options } from 'sequelize'

/**
 * Parses DATABASE_URL into Sequelize connection options.
 * Throws if the environment variable is not set.
 */
export const getDbOptions = (): Options => {
  const databaseUrl = process.env.DATABASE_URL
  if (!databaseUrl) {
    throw new Error('DATABASE_URL environment variable is required')
  }
  const parsed = new URL(databaseUrl)
  return {
    dialect: 'postgres',
    host: parsed.hostname,
    port: parseInt(parsed.port, 10) || 5432,
    database: parsed.pathname.replace(/^\//, ''),
    username: decodeURIComponent(parsed.username),
    password: decodeURIComponent(parsed.password),
    logging: false,
  }
}
