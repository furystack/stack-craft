import { Injector } from '@furystack/inject'
import { useLogging, VerboseConsoleLogger } from '@furystack/logging'
import { usingAsync } from '@furystack/utils'
import { execFileSync } from 'child_process'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { describe, expect, it } from 'vitest'

import { GitService } from './git-service.js'

const initBareRepo = (dir: string) => {
  execFileSync('git', ['init', '--bare'], { cwd: dir })
}

const initAndClone = (bareDir: string, workDir: string) => {
  execFileSync('git', ['clone', bareDir, workDir])
  execFileSync('git', ['config', 'user.email', 'test@test.com'], { cwd: workDir })
  execFileSync('git', ['config', 'user.name', 'Test'], { cwd: workDir })
  writeFileSync(join(workDir, 'file.txt'), 'hello')
  execFileSync('git', ['add', '.'], { cwd: workDir })
  execFileSync('git', ['commit', '-m', 'init'], { cwd: workDir })
  execFileSync('git', ['push'], { cwd: workDir })
}

const withGitTestContext = async (
  fn: (ctx: { git: GitService; tempDir: string; bareDir: string; workDir: string }) => Promise<void>,
) => {
  const tempDir = mkdtempSync(join(tmpdir(), 'git-service-test-'))
  try {
    await usingAsync(new Injector(), async (injector) => {
      useLogging(injector, VerboseConsoleLogger)
      const git = injector.get(GitService)

      const bareDir = join(tempDir, 'bare.git')
      const workDir = join(tempDir, 'work')
      mkdirSync(bareDir, { recursive: true })
      initBareRepo(bareDir)
      initAndClone(bareDir, workDir)

      await fn({ git, tempDir, bareDir, workDir })
    })
  } finally {
    rmSync(tempDir, { recursive: true, force: true })
  }
}

describe('GitService', () => {
  describe('pull', () => {
    it('should detect "Already up to date" as not updated', () =>
      withGitTestContext(async ({ git, workDir }) => {
        const result = await git.pull(workDir)
        expect(result.updated).toBe(false)
      }))

    it('should detect updates after a push to the remote', () =>
      withGitTestContext(async ({ git, tempDir, bareDir, workDir }) => {
        const secondClone = join(tempDir, 'second')
        execFileSync('git', ['clone', bareDir, secondClone])
        execFileSync('git', ['config', 'user.email', 'test@test.com'], { cwd: secondClone })
        execFileSync('git', ['config', 'user.name', 'Test'], { cwd: secondClone })
        writeFileSync(join(secondClone, 'new-file.txt'), 'new content')
        execFileSync('git', ['add', '.'], { cwd: secondClone })
        execFileSync('git', ['commit', '-m', 'add file'], { cwd: secondClone })
        execFileSync('git', ['push'], { cwd: secondClone })

        const result = await git.pull(workDir)
        expect(result.updated).toBe(true)
      }))
  })

  describe('getCurrentBranch', () => {
    it('should return the current branch name', () =>
      withGitTestContext(async ({ git, workDir }) => {
        const branch = await git.getCurrentBranch(workDir)
        expect(['main', 'master']).toContain(branch)
      }))
  })

  describe('getBranches', () => {
    it('should return local and remote branches', () =>
      withGitTestContext(async ({ git, workDir }) => {
        execFileSync('git', ['branch', 'feature-1'], { cwd: workDir })

        const { local, remote } = await git.getBranches(workDir)
        expect(local).toContain('feature-1')
        expect(remote.length).toBeGreaterThanOrEqual(1)
      }))
  })

  describe('checkout', () => {
    it('should switch branches', () =>
      withGitTestContext(async ({ git, workDir }) => {
        execFileSync('git', ['branch', 'develop'], { cwd: workDir })

        await git.checkout(workDir, 'develop')
        const branch = await git.getCurrentBranch(workDir)
        expect(branch).toBe('develop')
      }))
  })

  describe('clone', () => {
    it('should clone a repository', () =>
      withGitTestContext(async ({ git, tempDir, bareDir }) => {
        const cloneDir = join(tempDir, 'cloned')
        await git.clone(bareDir, cloneDir)

        const branch = await git.getCurrentBranch(cloneDir)
        expect(['main', 'master']).toContain(branch)
      }))
  })

  describe('hasRemoteBranch', () => {
    it('returns true for a tracked remote branch', () =>
      withGitTestContext(async ({ git, workDir }) => {
        const currentBranch = await git.getCurrentBranch(workDir)
        expect(await git.hasRemoteBranch(workDir, currentBranch)).toBe(true)
      }))

    it('returns false for a non-existent branch', () =>
      withGitTestContext(async ({ git, workDir }) => {
        expect(await git.hasRemoteBranch(workDir, 'nope-does-not-exist')).toBe(false)
      }))
  })

  describe('getWorktreeStatus', () => {
    it('reports a clean worktree', () =>
      withGitTestContext(async ({ git, workDir }) => {
        expect(await git.getWorktreeStatus(workDir)).toBe('clean')
      }))

    it('reports a dirty worktree when untracked/modified files exist', () =>
      withGitTestContext(async ({ git, workDir }) => {
        writeFileSync(join(workDir, 'extra.txt'), 'x')
        expect(await git.getWorktreeStatus(workDir)).toBe('dirty')
      }))
  })

  describe('revParse', () => {
    it('resolves HEAD to a SHA', () =>
      withGitTestContext(async ({ git, workDir }) => {
        const sha = await git.revParse(workDir, 'HEAD')
        expect(sha).toMatch(/^[0-9a-f]{40}$/)
      }))

    it('returns undefined for an unknown ref', () =>
      withGitTestContext(async ({ git, workDir }) => {
        expect(await git.revParse(workDir, 'refs/heads/ghost')).toBeUndefined()
      }))
  })

  describe('deleteLocalBranch', () => {
    it('removes a merged local branch', () =>
      withGitTestContext(async ({ git, workDir }) => {
        execFileSync('git', ['branch', 'to-delete'], { cwd: workDir })
        await git.deleteLocalBranch(workDir, 'to-delete')
        const { local } = await git.getBranches(workDir)
        expect(local).not.toContain('to-delete')
      }))
  })
})
