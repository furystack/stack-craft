import { defineService, type Token, type Injector } from '@furystack/inject'
import { getLogger } from '@furystack/logging'
import type { Semaphore } from '@furystack/utils'

import { runCli, type RunCliResult } from '../utils/run-cli.js'
import { GitOperationLimit } from './operation-limits.js'

const TIMEOUTS = {
  CLONE_MS: 5 * 60 * 1000,
  FETCH_MS: 90 * 1000,
  PULL_MS: 90 * 1000,
  CHECKOUT_MS: 30 * 1000,
  CHEAP_READ_MS: 10 * 1000,
  REF_LOOKUP_MS: 5 * 1000,
  LS_REMOTE_MS: 30 * 1000,
} as const

/**
 * Env hardening applied to every git invocation. Inherits the host env so git
 * can find ssh-agent / credential helpers / PATH, then forces non-interactive
 * mode so missing or expired credentials fail fast instead of popping a prompt
 * (terminal or GUI) that nobody can answer from a backend service.
 *
 * - `GIT_TERMINAL_PROMPT=0` — no terminal prompts on missing HTTPS creds.
 * - Removes inherited `GIT_ASKPASS` / `SSH_ASKPASS` so no GUI helper is invoked.
 * - `SSH_ASKPASS_REQUIRE=never` — keeps ssh from spawning askpass even if `DISPLAY` is set.
 * - `GIT_SSH_COMMAND` — `BatchMode=yes` blocks every ssh prompt; `ConnectTimeout` caps DNS/TCP waits.
 */
const GIT_ENV: Record<string, string | undefined> = {
  GIT_ASKPASS: undefined,
  SSH_ASKPASS: undefined,
  GIT_TERMINAL_PROMPT: '0',
  SSH_ASKPASS_REQUIRE: 'never',
  GIT_SSH_COMMAND: 'ssh -o BatchMode=yes -o ConnectTimeout=15 -o StrictHostKeyChecking=accept-new',
}

const runGit = (
  args: readonly string[],
  options: { cwd?: string; timeoutMs: number; signal?: AbortSignal },
): Promise<RunCliResult> => runCli('git', args, { ...options, env: GIT_ENV })

/** Low-level wrapper around git CLI operations (clone, fetch, pull, checkout, branch listing) */
class GitServiceImpl {
  private logger!: ReturnType<ReturnType<typeof getLogger>['withScope']>
  private limit: Semaphore

  constructor(injector: Injector) {
    this.logger = getLogger(injector).withScope('GitService')
    this.limit = injector.get(GitOperationLimit)
  }

  /**
   * Routes the underlying `runCli` call through {@link GitOperationLimit} so
   * concurrent git invocations stay under the configured ceiling. The semaphore
   * forwards an `AbortSignal` that fires on injector dispose; `runCli` honours
   * it by killing the process group, so in-flight ops don't leak past shutdown.
   */
  private guarded(args: readonly string[], options: { cwd?: string; timeoutMs: number }): Promise<RunCliResult> {
    return this.limit.execute(({ signal }) => runGit(args, { ...options, signal }))
  }

  public async clone(url: string, directory: string): Promise<void> {
    await this.logger.information({ message: `Cloning ${url} into ${directory}` })
    await this.guarded(['clone', url, directory], { timeoutMs: TIMEOUTS.CLONE_MS })
  }

  public async fetch(directory: string): Promise<void> {
    await this.logger.verbose({ message: `Fetching in ${directory}` })
    await this.guarded(['fetch', '--all', '--prune'], { cwd: directory, timeoutMs: TIMEOUTS.FETCH_MS })
  }

  public async pull(directory: string): Promise<{ updated: boolean }> {
    await this.logger.information({ message: `Pulling in ${directory}` })
    const { stdout } = await this.guarded(['pull'], { cwd: directory, timeoutMs: TIMEOUTS.PULL_MS })
    const updated = !stdout.includes('Already up to date')
    return { updated }
  }

  public async getBranches(directory: string): Promise<{ local: string[]; remote: string[] }> {
    const { stdout: localOut } = await this.guarded(['branch', '--format=%(refname:short)'], {
      cwd: directory,
      timeoutMs: TIMEOUTS.CHEAP_READ_MS,
    })
    const { stdout: remoteOut } = await this.guarded(['branch', '-r', '--format=%(refname:short)'], {
      cwd: directory,
      timeoutMs: TIMEOUTS.CHEAP_READ_MS,
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
    const { stdout } = await this.guarded(['branch', '--show-current'], {
      cwd: directory,
      timeoutMs: TIMEOUTS.CHEAP_READ_MS,
    })
    return stdout.trim()
  }

  public async getCommitsBehind(directory: string, branch: string): Promise<number> {
    try {
      const { stdout } = await this.guarded(['rev-list', '--count', `HEAD..origin/${branch}`], {
        cwd: directory,
        timeoutMs: TIMEOUTS.CHEAP_READ_MS,
      })
      return parseInt(stdout.trim(), 10) || 0
    } catch {
      return 0
    }
  }

  public async checkout(directory: string, branch: string): Promise<void> {
    await this.logger.information({ message: `Checking out ${branch} in ${directory}` })
    await this.guarded(['checkout', branch], { cwd: directory, timeoutMs: TIMEOUTS.CHECKOUT_MS })
  }

  /** Deletes a local branch. Uses `-D` (force) when `force` is true, otherwise `-d` (safe). */
  public async deleteLocalBranch(directory: string, branch: string, force = false): Promise<void> {
    await this.logger.information({ message: `Deleting local branch ${branch} in ${directory}` })
    await this.guarded(['branch', force ? '-D' : '-d', branch], {
      cwd: directory,
      timeoutMs: TIMEOUTS.CHEAP_READ_MS,
    })
  }

  /** Returns true if `origin/<branch>` has a resolvable ref locally (i.e. the branch exists on the remote after a fetch). */
  public async hasRemoteBranch(directory: string, branch: string): Promise<boolean> {
    try {
      await this.guarded(['show-ref', '--verify', '--quiet', `refs/remotes/origin/${branch}`], {
        cwd: directory,
        timeoutMs: TIMEOUTS.REF_LOOKUP_MS,
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
      const { stdout } = await this.guarded(['symbolic-ref', '--short', '--quiet', 'refs/remotes/origin/HEAD'], {
        cwd: directory,
        timeoutMs: TIMEOUTS.REF_LOOKUP_MS,
      })
      const trimmed = stdout.trim()
      return trimmed.startsWith('origin/') ? trimmed.slice('origin/'.length) : trimmed || undefined
    } catch {
      return undefined
    }
  }

  /** Runs `git status --porcelain` and classifies the working tree. */
  public async getWorktreeStatus(directory: string): Promise<'clean' | 'dirty' | 'conflicts'> {
    const { stdout } = await this.guarded(['status', '--porcelain'], {
      cwd: directory,
      timeoutMs: TIMEOUTS.CHEAP_READ_MS,
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
      const { stdout } = await this.guarded(['rev-parse', '--quiet', '--verify', ref], {
        cwd: directory,
        timeoutMs: TIMEOUTS.REF_LOOKUP_MS,
      })
      return stdout.trim() || undefined
    } catch {
      return undefined
    }
  }

  /**
   * Probes whether a remote URL is reachable and authorized via `git ls-remote --exit-code`.
   * Resolves on success, rejects with an error containing stderr context on failure or timeout.
   *
   * Use this for repository accessibility checks (validate-repo flows, pre-clone probing). Goes
   * through the same env hardening (GIT_TERMINAL_PROMPT=0, BatchMode ssh) and shares the
   * {@link GitOperationLimit} pool with the rest of the git CLI calls.
   */
  public async lsRemote(url: string): Promise<void> {
    await this.guarded(['ls-remote', '--exit-code', url], { timeoutMs: TIMEOUTS.LS_REMOTE_MS })
  }
}

export type GitService = GitServiceImpl

export const GitService: Token<GitService, 'singleton'> = defineService({
  name: 'app/GitService',
  lifetime: 'singleton',
  factory: ({ injector }) => new GitServiceImpl(injector),
})
