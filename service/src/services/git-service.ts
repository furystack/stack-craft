import { defineService, type Token, type Injector } from '@furystack/inject'
import { getLogger } from '@furystack/logging'
import { execFile } from 'child_process'
import { promisify } from 'util'

const execFileAsync = promisify(execFile)

/** Low-level wrapper around git CLI operations (clone, fetch, pull, checkout, branch listing) */
class GitServiceImpl {
  private logger!: ReturnType<ReturnType<typeof getLogger>['withScope']>

  constructor(injector: Injector) {
    this.logger = getLogger(injector).withScope('GitService')
  }

  public async clone(url: string, directory: string): Promise<void> {
    await this.logger.information({ message: `Cloning ${url} into ${directory}` })
    await execFileAsync('git', ['clone', url, directory], { timeout: 300000 })
  }

  public async fetch(directory: string): Promise<void> {
    await this.logger.verbose({ message: `Fetching in ${directory}` })
    await execFileAsync('git', ['fetch', '--all', '--prune'], { cwd: directory, timeout: 60000 })
  }

  public async pull(directory: string): Promise<{ updated: boolean }> {
    await this.logger.information({ message: `Pulling in ${directory}` })
    const { stdout } = await execFileAsync('git', ['pull'], { cwd: directory, timeout: 60000 })
    const updated = !stdout.includes('Already up to date')
    return { updated }
  }

  public async getBranches(directory: string): Promise<{ local: string[]; remote: string[] }> {
    const { stdout: localOut } = await execFileAsync('git', ['branch', '--format=%(refname:short)'], {
      cwd: directory,
      timeout: 10000,
    })
    const { stdout: remoteOut } = await execFileAsync('git', ['branch', '-r', '--format=%(refname:short)'], {
      cwd: directory,
      timeout: 10000,
    })

    const local = localOut
      .split('\n')
      .map((b) => b.trim())
      .filter(Boolean)
    const remote = remoteOut
      .split('\n')
      .map((b) => b.trim())
      .filter(Boolean)

    return { local, remote }
  }

  public async getCurrentBranch(directory: string): Promise<string> {
    const { stdout } = await execFileAsync('git', ['branch', '--show-current'], {
      cwd: directory,
      timeout: 10000,
    })
    return stdout.trim()
  }

  public async getCommitsBehind(directory: string, branch: string): Promise<number> {
    try {
      const { stdout } = await execFileAsync('git', ['rev-list', '--count', `HEAD..origin/${branch}`], {
        cwd: directory,
        timeout: 10000,
      })
      return parseInt(stdout.trim(), 10) || 0
    } catch {
      return 0
    }
  }

  public async checkout(directory: string, branch: string): Promise<void> {
    await this.logger.information({ message: `Checking out ${branch} in ${directory}` })
    await execFileAsync('git', ['checkout', branch], { cwd: directory, timeout: 30000 })
  }

  /** Deletes a local branch. Uses `-D` (force) when `force` is true, otherwise `-d` (safe). */
  public async deleteLocalBranch(directory: string, branch: string, force = false): Promise<void> {
    await this.logger.information({ message: `Deleting local branch ${branch} in ${directory}` })
    await execFileAsync('git', ['branch', force ? '-D' : '-d', branch], { cwd: directory, timeout: 10000 })
  }

  /** Returns true if `origin/<branch>` has a resolvable ref locally (i.e. the branch exists on the remote after a fetch). */
  public async hasRemoteBranch(directory: string, branch: string): Promise<boolean> {
    try {
      await execFileAsync('git', ['show-ref', '--verify', '--quiet', `refs/remotes/origin/${branch}`], {
        cwd: directory,
        timeout: 5000,
      })
      return true
    } catch {
      return false
    }
  }

  /**
   * Returns the default branch name as reported by `refs/remotes/origin/HEAD`.
   * Falls back to `undefined` if the symref is missing (older clones, etc.).
   */
  public async getDefaultBranch(directory: string): Promise<string | undefined> {
    try {
      const { stdout } = await execFileAsync(
        'git',
        ['symbolic-ref', '--short', '--quiet', 'refs/remotes/origin/HEAD'],
        { cwd: directory, timeout: 5000 },
      )
      const trimmed = stdout.trim()
      return trimmed.startsWith('origin/') ? trimmed.slice('origin/'.length) : trimmed || undefined
    } catch {
      return undefined
    }
  }

  /** Runs `git status --porcelain` and classifies the working tree. */
  public async getWorktreeStatus(directory: string): Promise<'clean' | 'dirty' | 'conflicts'> {
    const { stdout } = await execFileAsync('git', ['status', '--porcelain'], {
      cwd: directory,
      timeout: 10000,
    })
    const lines = stdout.split('\n').filter((l) => l.length > 0)
    if (lines.length === 0) return 'clean'
    const hasConflicts = lines.some((line) => {
      const code = line.slice(0, 2)
      return code === 'UU' || code === 'AA' || code === 'DD' || code.startsWith('U') || code.endsWith('U')
    })
    return hasConflicts ? 'conflicts' : 'dirty'
  }

  /** Returns the SHA that a given ref points to (e.g. `HEAD`, `refs/heads/main`). Returns undefined if unresolvable. */
  public async revParse(directory: string, ref: string): Promise<string | undefined> {
    try {
      const { stdout } = await execFileAsync('git', ['rev-parse', '--quiet', '--verify', ref], {
        cwd: directory,
        timeout: 5000,
      })
      return stdout.trim() || undefined
    } catch {
      return undefined
    }
  }
}

export type GitService = GitServiceImpl

export const GitService: Token<GitService, 'singleton'> = defineService({
  name: 'app/GitService',
  lifetime: 'singleton',
  factory: ({ injector }) => new GitServiceImpl(injector),
})
