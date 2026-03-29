import { homedir } from 'os'
import { resolve } from 'path'

/**
 * Resolves a path for file system operations.
 * Expands ~ to the user's home directory so that existsSync, mkdirSync, and git
 * commands all see the same absolute path.
 */
export function resolvePath(path: string): string {
  const expanded = path.startsWith('~/') || path.startsWith('~\\') || path === '~' ? path.replace(/^~/, homedir()) : path
  return resolve(expanded)
}
