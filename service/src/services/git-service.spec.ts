import { Injector } from '@furystack/inject'
import { useLogging, VerboseConsoleLogger } from '@furystack/logging'
import { mkdtempSync, rmSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { GitService } from './git-service.js'

describe('GitService', () => {
  let injector: Injector
  let git: GitService
  let tempDir: string

  beforeEach(() => {
    injector = new Injector()
    useLogging(injector, VerboseConsoleLogger)
    git = injector.getInstance(GitService)
    tempDir = mkdtempSync(join(tmpdir(), 'git-service-test-'))
  })

  afterEach(async () => {
    rmSync(tempDir, { recursive: true, force: true })
    await injector[Symbol.asyncDispose]()
  })

  describe('pull', () => {
    it('should detect "Already up to date" as not updated', async () => {
      const { execFileSync } = await import('child_process')
      execFileSync('git', ['init'], { cwd: tempDir })
      execFileSync('git', ['config', 'user.email', 'test@test.com'], { cwd: tempDir })
      execFileSync('git', ['config', 'user.name', 'Test'], { cwd: tempDir })
      writeFileSync(join(tempDir, 'file.txt'), 'hello')
      execFileSync('git', ['add', '.'], { cwd: tempDir })
      execFileSync('git', ['commit', '-m', 'init'], { cwd: tempDir })

      const result = await git.pull(tempDir)
      expect(result.updated).toBe(false)
    })
  })

  describe('getCurrentBranch', () => {
    it('should return the current branch name', async () => {
      const { execFileSync } = await import('child_process')
      execFileSync('git', ['init', '-b', 'main'], { cwd: tempDir })
      execFileSync('git', ['config', 'user.email', 'test@test.com'], { cwd: tempDir })
      execFileSync('git', ['config', 'user.name', 'Test'], { cwd: tempDir })
      writeFileSync(join(tempDir, 'file.txt'), 'hello')
      execFileSync('git', ['add', '.'], { cwd: tempDir })
      execFileSync('git', ['commit', '-m', 'init'], { cwd: tempDir })

      const branch = await git.getCurrentBranch(tempDir)
      expect(branch).toBe('main')
    })
  })

  describe('getBranches', () => {
    it('should return local branches', async () => {
      const { execFileSync } = await import('child_process')
      execFileSync('git', ['init', '-b', 'main'], { cwd: tempDir })
      execFileSync('git', ['config', 'user.email', 'test@test.com'], { cwd: tempDir })
      execFileSync('git', ['config', 'user.name', 'Test'], { cwd: tempDir })
      writeFileSync(join(tempDir, 'file.txt'), 'hello')
      execFileSync('git', ['add', '.'], { cwd: tempDir })
      execFileSync('git', ['commit', '-m', 'init'], { cwd: tempDir })
      execFileSync('git', ['branch', 'feature-1'], { cwd: tempDir })

      const { local, remote } = await git.getBranches(tempDir)
      expect(local).toContain('main')
      expect(local).toContain('feature-1')
      expect(remote).toEqual([])
    })
  })

  describe('checkout', () => {
    it('should switch branches', async () => {
      const { execFileSync } = await import('child_process')
      execFileSync('git', ['init', '-b', 'main'], { cwd: tempDir })
      execFileSync('git', ['config', 'user.email', 'test@test.com'], { cwd: tempDir })
      execFileSync('git', ['config', 'user.name', 'Test'], { cwd: tempDir })
      writeFileSync(join(tempDir, 'file.txt'), 'hello')
      execFileSync('git', ['add', '.'], { cwd: tempDir })
      execFileSync('git', ['commit', '-m', 'init'], { cwd: tempDir })
      execFileSync('git', ['branch', 'develop'], { cwd: tempDir })

      await git.checkout(tempDir, 'develop')
      const branch = await git.getCurrentBranch(tempDir)
      expect(branch).toBe('develop')
    })
  })
})
