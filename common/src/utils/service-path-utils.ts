import type { GitHubRepository } from '../models/index.js'

function joinPath(...parts: Array<string | undefined>): string {
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
 * Formula: join(mainDirectory, workingDirectory ?? '', repoName when cloned)
 *
 * - mainDirectory comes from {@link StackConfig} and is the root for all processes in the stack
 * - workingDirectory comes from {@link ServiceDefinition} and is optional, for grouping
 * - When cloning from Git, the repo name is added as a subdirectory
 */
export function getServiceCwd(
  config: { mainDirectory: string },
  service: { workingDirectory?: string },
  repo?: GitHubRepository | null,
): string {
  const base = joinPath(config.mainDirectory, service.workingDirectory)
  if (repo?.url) {
    return joinPath(base, getRepoNameFromUrl(repo.url))
  }
  return base
}
