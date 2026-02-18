import type { GitHubRepository, Service, Stack } from '../models/index.js'

function joinPath(...parts: (string | undefined)[]): string {
  return parts
    .filter((p): p is string => typeof p === 'string' && p !== '')
    .map((p) => p.replace(/\\/g, '/'))
    .join('/')
    .replace(/\/+/g, '/')
}

/**
 * Extracts the repository name from a Git URL.
 * e.g. "https://github.com/user/my-repo.git" -> "my-repo"
 */
export function getRepoNameFromUrl(url: string): string {
  const match = url.match(/\/([^/]+?)(?:\.git)?$/i)
  return match ? match[1] : 'repo'
}

/**
 * Computes the full working directory (CWD) for a service.
 * Formula: join(stack.mainDirectory, service.workingDirectory ?? '', repoName when cloned)
 *
 * - Stack mainDirectory is the root for all processes in the stack
 * - Service workingDirectory is optional, for grouping (e.g. "frontends/public", "services/gateways")
 * - When cloning from Git, the repo name is added as a subdirectory
 */
export function getServiceCwd(
  stack: Stack,
  service: Service,
  repo?: GitHubRepository | null,
): string {
  const base = joinPath(stack.mainDirectory, service.workingDirectory)
  if (repo?.url) {
    return joinPath(base, getRepoNameFromUrl(repo.url))
  }
  return base
}
