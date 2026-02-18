import { getStoreManager } from '@furystack/core'
import type { Injector } from '@furystack/inject'
import { Injectable, Injected } from '@furystack/inject'
import { getLogger } from '@furystack/logging'
import type { InstallStatus, BuildStatus, RunStatus } from 'common'
import { Service } from 'common'
import { type ChildProcess, spawn } from 'child_process'
import { WebsocketService } from './websocket-service.js'

const MAX_LOG_LINES = 10_000

type ManagedProcess = {
  serviceId: string
  process: ChildProcess
  purpose: 'run' | 'install' | 'build'
  logBuffer: string[]
}

@Injectable({ lifetime: 'singleton' })
export class ProcessManager {
  private processes = new Map<string, ManagedProcess>()

  @Injected((injector) => getLogger(injector).withScope('ProcessManager'))
  declare private logger: ReturnType<ReturnType<typeof getLogger>['withScope']>

  @Injected(WebsocketService)
  declare private ws: WebsocketService

  public getLogLines(serviceId: string, count?: number): string[] {
    const managed = this.processes.get(serviceId)
    if (!managed) return []
    const lines = managed.logBuffer
    return count ? lines.slice(-count) : [...lines]
  }

  private addLogLine(serviceId: string, stream: 'stdout' | 'stderr', line: string) {
    const managed = this.processes.get(serviceId)
    if (!managed) return
    managed.logBuffer.push(line)
    if (managed.logBuffer.length > MAX_LOG_LINES) {
      managed.logBuffer.splice(0, managed.logBuffer.length - MAX_LOG_LINES)
    }
    void this.ws.announce({ type: 'service-log', serviceId, stream, line })
  }

  private async updateServiceStatus(
    serviceId: string,
    update: { installStatus?: InstallStatus; buildStatus?: BuildStatus; runStatus?: RunStatus },
  ) {
    const sm = getStoreManager(this.injector)
    const store = sm.getStoreFor(Service, 'id')

    const services = await store.find({ filter: { id: { $eq: serviceId } }, top: 1 })
    const svc = services[0]
    if (!svc) return

    const now = new Date().toISOString()
    const patchData: Partial<Service> = { ...update, updatedAt: now }

    if (update.installStatus === 'installed') patchData.lastInstalledAt = now
    if (update.buildStatus === 'built') patchData.lastBuiltAt = now
    if (update.runStatus === 'running') patchData.lastStartedAt = now

    await store.update(serviceId, patchData)

    void this.ws.announce({
      type: 'service-status-changed',
      serviceId,
      installStatus: update.installStatus ?? svc.installStatus,
      buildStatus: update.buildStatus ?? svc.buildStatus,
      runStatus: update.runStatus ?? svc.runStatus,
    })
  }

  public async startService(serviceId: string): Promise<void> {
    const sm = getStoreManager(this.injector)
    const services = await sm.getStoreFor(Service, 'id').find({ filter: { id: { $eq: serviceId } }, top: 1 })
    const svc = services[0]
    if (!svc) throw new Error(`Service not found: ${serviceId}`)

    if (this.processes.has(serviceId)) {
      throw new Error(`Service already has a running process: ${serviceId}`)
    }

    await this.logger.information({ message: `Starting service: ${svc.displayName}` })
    await this.updateServiceStatus(serviceId, { runStatus: 'starting' })

    const child = this.spawnCommand(svc.runCommand, svc.workingDirectory)

    const managed: ManagedProcess = {
      serviceId,
      process: child,
      purpose: 'run',
      logBuffer: [],
    }
    this.processes.set(serviceId, managed)

    child.stdout?.on('data', (data: Buffer) => {
      const lines = data.toString().split('\n').filter(Boolean)
      lines.forEach((line) => this.addLogLine(serviceId, 'stdout', line))
    })

    child.stderr?.on('data', (data: Buffer) => {
      const lines = data.toString().split('\n').filter(Boolean)
      lines.forEach((line) => this.addLogLine(serviceId, 'stderr', line))
    })

    child.on('error', (err) => {
      void this.logger.error({ message: `Service error: ${svc.displayName}`, data: { error: err } })
      void this.updateServiceStatus(serviceId, { runStatus: 'error' })
      this.processes.delete(serviceId)
    })

    child.on('exit', (code) => {
      void this.logger.information({ message: `Service exited: ${svc.displayName} (code ${code})` })
      const newStatus: RunStatus = code === 0 ? 'stopped' : 'error'
      void this.updateServiceStatus(serviceId, { runStatus: newStatus })
      this.processes.delete(serviceId)
    })

    await this.updateServiceStatus(serviceId, { runStatus: 'running' })
  }

  public async stopService(serviceId: string): Promise<void> {
    const managed = this.processes.get(serviceId)
    if (!managed || managed.purpose !== 'run') {
      throw new Error(`No running process for service: ${serviceId}`)
    }

    await this.logger.information({ message: `Stopping service: ${serviceId}` })
    await this.updateServiceStatus(serviceId, { runStatus: 'stopping' })

    managed.process.kill('SIGTERM')

    await new Promise<void>((resolve) => {
      const timeout = setTimeout(() => {
        managed.process.kill('SIGKILL')
        resolve()
      }, 10000)

      managed.process.on('exit', () => {
        clearTimeout(timeout)
        resolve()
      })
    })
  }

  public async restartService(serviceId: string): Promise<void> {
    if (this.processes.has(serviceId)) {
      await this.stopService(serviceId)
    }
    await this.startService(serviceId)
  }

  public async installService(serviceId: string): Promise<void> {
    const sm = getStoreManager(this.injector)
    const services = await sm.getStoreFor(Service, 'id').find({ filter: { id: { $eq: serviceId } }, top: 1 })
    const svc = services[0]
    if (!svc?.installCommand) throw new Error(`No install command for service: ${serviceId}`)

    await this.runOneShot(serviceId, svc.installCommand, svc.workingDirectory, 'install')
  }

  public async buildService(serviceId: string): Promise<void> {
    const sm = getStoreManager(this.injector)
    const services = await sm.getStoreFor(Service, 'id').find({ filter: { id: { $eq: serviceId } }, top: 1 })
    const svc = services[0]
    if (!svc?.buildCommand) throw new Error(`No build command for service: ${serviceId}`)

    await this.runOneShot(serviceId, svc.buildCommand, svc.workingDirectory, 'build')
  }

  private async runOneShot(
    serviceId: string,
    command: string,
    cwd: string,
    purpose: 'install' | 'build',
  ): Promise<void> {
    const statusField = purpose === 'install' ? 'installStatus' : 'buildStatus'
    const progressValue = purpose === 'install' ? 'installing' : 'building'
    const doneValue = purpose === 'install' ? 'installed' : 'built'

    await this.updateServiceStatus(serviceId, { [statusField]: progressValue as never })

    const child = this.spawnCommand(command, cwd)

    const managed: ManagedProcess = {
      serviceId,
      process: child,
      purpose,
      logBuffer: this.processes.get(serviceId)?.logBuffer ?? [],
    }
    this.processes.set(serviceId, managed)

    child.stdout?.on('data', (data: Buffer) => {
      data
        .toString()
        .split('\n')
        .filter(Boolean)
        .forEach((line) => this.addLogLine(serviceId, 'stdout', line))
    })

    child.stderr?.on('data', (data: Buffer) => {
      data
        .toString()
        .split('\n')
        .filter(Boolean)
        .forEach((line) => this.addLogLine(serviceId, 'stderr', line))
    })

    return new Promise((resolve, reject) => {
      child.on('error', (err) => {
        void this.updateServiceStatus(serviceId, { [statusField]: 'failed' as never })
        this.processes.delete(serviceId)
        reject(err)
      })

      child.on('exit', (code) => {
        if (code === 0) {
          void this.updateServiceStatus(serviceId, { [statusField]: doneValue as never })
        } else {
          void this.updateServiceStatus(serviceId, { [statusField]: 'failed' as never })
        }
        this.processes.delete(serviceId)
        resolve()
      })
    })
  }

  private spawnCommand(command: string, cwd: string): ChildProcess {
    const isWindows = process.platform === 'win32'
    const shell = isWindows ? 'cmd.exe' : '/bin/sh'
    const shellFlag = isWindows ? '/c' : '-c'

    return spawn(shell, [shellFlag, command], {
      cwd,
      stdio: ['ignore', 'pipe', 'pipe'],
      env: { ...process.env },
    })
  }

  public async [Symbol.asyncDispose]() {
    await this.logger.information({ message: 'Disposing ProcessManager, killing all child processes...' })
    for (const [serviceId, managed] of this.processes) {
      await this.logger.information({ message: `Killing process for service: ${serviceId}` })
      managed.process.kill('SIGKILL')
    }
    this.processes.clear()
  }

  @Injected((i: unknown) => i)
  declare private injector: Injector
}
