import { Injectable, Injected } from '@furystack/inject'
import { getLogger } from '@furystack/logging'
import { execFile } from 'child_process'
import { promisify } from 'util'

const execFileAsync = promisify(execFile)

/** Low-level wrapper around git CLI operations (clone, fetch, pull, checkout, branch listing) */
@Injectable({ lifetime: 'singleton' })
export class GitService {
  @Injected((injector) => getLogger(injector).withScope('GitService'))
  declare private logger: ReturnType<ReturnType<typeof getLogger>['withScope']>

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
}
