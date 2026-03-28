import { Injector } from '@furystack/inject'
import { useLogging, VerboseConsoleLogger } from '@furystack/logging'
import { execFileSync } from 'child_process'
import { mkdtempSync, rmSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

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

describe('GitService', () => {
  let injector: Injector
  let git: GitService
  let tempDir: string
  let bareDir: string
  let workDir: string

  beforeEach(() => {
    injector = new Injector()
    useLogging(injector, VerboseConsoleLogger)
    git = injector.getInstance(GitService)

    tempDir = mkdtempSync(join(tmpdir(), 'git-service-test-'))
    bareDir = join(tempDir, 'bare.git')
    workDir = join(tempDir, 'work')

    execFileSync('mkdir', ['-p', bareDir])
    initBareRepo(bareDir)
    initAndClone(bareDir, workDir)
  })

  afterEach(async () => {
    rmSync(tempDir, { recursive: true, force: true })
    await injector[Symbol.asyncDispose]()
  })

  describe('pull', () => {
    it('should detect "Already up to date" as not updated', async () => {
      const result = await git.pull(workDir)
      expect(result.updated).toBe(false)
    })

    it('should detect updates after a push to the remote', async () => {
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
    })
  })

  describe('getCurrentBranch', () => {
    it('should return the current branch name', async () => {
      const branch = await git.getCurrentBranch(workDir)
      expect(['main', 'master']).toContain(branch)
    })
  })

  describe('getBranches', () => {
    it('should return local and remote branches', async () => {
      execFileSync('git', ['branch', 'feature-1'], { cwd: workDir })

      const { local, remote } = await git.getBranches(workDir)
      expect(local).toContain('feature-1')
      expect(remote.length).toBeGreaterThanOrEqual(1)
    })
  })

  describe('checkout', () => {
    it('should switch branches', async () => {
      execFileSync('git', ['branch', 'develop'], { cwd: workDir })

      await git.checkout(workDir, 'develop')
      const branch = await git.getCurrentBranch(workDir)
      expect(branch).toBe('develop')
    })
  })

  describe('clone', () => {
    it('should clone a repository', async () => {
      const cloneDir = join(tempDir, 'cloned')
      await git.clone(bareDir, cloneDir)

      const branch = await git.getCurrentBranch(cloneDir)
      expect(['main', 'master']).toContain(branch)
    })
  })
})
