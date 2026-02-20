import { Injectable, Injected, type Injector, getInjectorReference } from '@furystack/inject'
import { getLogger } from '@furystack/logging'
import { getRepository } from '@furystack/repository'
import type { InstallStatus, BuildStatus, RunStatus, ServiceStateEvent, TriggerSource } from 'common'
import { ServiceDefinition, ServiceStateHistory, ServiceStatus } from 'common'
import { type ChildProcess, spawn } from 'child_process'
import { randomUUID } from 'crypto'

import { useSystemIdentityContext } from '@furystack/core'
import { resolveServiceCwd } from '../utils/resolve-service-cwd.js'
import { LogStorageService } from './log-storage-service.js'
import { WebsocketService } from './websocket-service.js'

type ManagedProcess = {
  serviceId: string
  process: ChildProcess
  purpose: 'run' | 'install' | 'build'
  processUid: string
}

type TriggerContext = {
  triggeredBy: string
  triggerSource: TriggerSource
}

@Injectable({ lifetime: 'singleton' })
export class ProcessManager {
  private processes = new Map<string, ManagedProcess>()
  private pendingOperations = new Set<string>()
  private elevatedInjector?: Injector

  private getElevatedInjector(): Injector {
    if (!this.elevatedInjector) {
      this.elevatedInjector = useSystemIdentityContext({ injector: getInjectorReference(this) })
    }
    return this.elevatedInjector
  }

  @Injected((injector) => getLogger(injector).withScope('ProcessManager'))
  declare private logger: ReturnType<ReturnType<typeof getLogger>['withScope']>

  @Injected(LogStorageService)
  declare private logStorage: LogStorageService

  @Injected(WebsocketService)
  declare private ws: WebsocketService

  private addLogLine(serviceId: string, stream: 'stdout' | 'stderr', line: string) {
    const managed = this.processes.get(serviceId)
    if (!managed) return
    void this.logStorage.addEntry(serviceId, managed.processUid, stream, line)
  }

  private async updateServiceStatus(
    serviceId: string,
    update: { installStatus?: InstallStatus; buildStatus?: BuildStatus; runStatus?: RunStatus },
    event: ServiceStateEvent,
    trigger: TriggerContext,
    metadata?: Record<string, unknown>,
  ) {
    try {
      const elevated = this.getElevatedInjector()
      const statusDs = getRepository(elevated).getDataSetFor(ServiceStatus, 'serviceId')
      const historyDs = getRepository(elevated).getDataSetFor(ServiceStateHistory, 'id')

      const statuses = await statusDs.find(elevated, { filter: { serviceId: { $eq: serviceId } }, top: 1 })
      const current = statuses[0]
      if (!current) return

      const now = new Date().toISOString()
      const patchData: Partial<ServiceStatus> = { ...update, updatedAt: now }

      if (update.installStatus === 'installed') patchData.lastInstalledAt = now
      if (update.buildStatus === 'built') patchData.lastBuiltAt = now
      if (update.runStatus === 'running') patchData.lastStartedAt = now

      const previousState = JSON.stringify({
        installStatus: current.installStatus,
        buildStatus: current.buildStatus,
        runStatus: current.runStatus,
      })

      await statusDs.update(elevated, serviceId, patchData)

      const newState = JSON.stringify({
        installStatus: update.installStatus ?? current.installStatus,
        buildStatus: update.buildStatus ?? current.buildStatus,
        runStatus: update.runStatus ?? current.runStatus,
      })

      await historyDs.add(elevated, {
        id: 0,
        serviceId,
        event,
        previousState,
        newState,
        triggeredBy: trigger.triggeredBy,
        triggerSource: trigger.triggerSource,
        metadata: metadata ? JSON.stringify(metadata) : undefined,
        createdAt: now,
      })

      void this.ws.announce({
        type: 'service-status-changed',
        serviceId,
        installStatus: update.installStatus ?? current.installStatus,
        buildStatus: update.buildStatus ?? current.buildStatus,
        runStatus: update.runStatus ?? current.runStatus,
      })
    } catch {
      // May fire after disposal during shutdown — safe to ignore
    }
  }

  public async startService(serviceId: string, trigger: TriggerContext): Promise<void> {
    const elevated = this.getElevatedInjector()
    const services = await getRepository(elevated)
      .getDataSetFor(ServiceDefinition, 'id')
      .find(elevated, { filter: { id: { $eq: serviceId } }, top: 1 })
    const svc = services[0]
    if (!svc) throw new Error(`Service not found: ${serviceId}`)

    if (this.processes.has(serviceId) || this.pendingOperations.has(serviceId)) {
      throw new Error(`Service already has a running process: ${serviceId}`)
    }

    this.pendingOperations.add(serviceId)
    try {
      await this.logger.information({ message: `Starting service: ${svc.displayName}` })
      await this.updateServiceStatus(serviceId, { runStatus: 'starting' }, 'run-started', trigger)

      const cwd = await resolveServiceCwd(getInjectorReference(this), svc, elevated)
      const child = this.spawnCommand(svc.runCommand, cwd)
      const processUid = randomUUID()

      const managed: ManagedProcess = {
        serviceId,
        process: child,
        purpose: 'run',
        processUid,
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
        void this.updateServiceStatus(serviceId, { runStatus: 'error' }, 'run-crashed', trigger, { error: err.message })
        this.processes.delete(serviceId)
      })

      child.on('exit', (code) => {
        void this.logger.information({ message: `Service exited: ${svc.displayName} (code ${code})` })
        const newStatus: RunStatus = code === 0 ? 'stopped' : 'error'
        const event: ServiceStateEvent = code === 0 ? 'run-stopped' : 'run-crashed'
        void this.updateServiceStatus(serviceId, { runStatus: newStatus }, event, trigger, { exitCode: code })
        this.processes.delete(serviceId)
      })

      child.on('spawn', () => {
        void this.updateServiceStatus(serviceId, { runStatus: 'running' }, 'run-started', trigger)
      })
    } finally {
      this.pendingOperations.delete(serviceId)
    }
  }

  public async stopService(serviceId: string, trigger: TriggerContext): Promise<void> {
    const managed = this.processes.get(serviceId)
    if (!managed || managed.purpose !== 'run') {
      throw new Error(`No running process for service: ${serviceId}`)
    }

    await this.logger.information({ message: `Stopping service: ${serviceId}` })
    await this.updateServiceStatus(serviceId, { runStatus: 'stopping' }, 'run-stopped', trigger)

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

  public async restartService(serviceId: string, trigger: TriggerContext): Promise<void> {
    if (this.processes.has(serviceId)) {
      await this.stopService(serviceId, trigger)
    }
    await this.startService(serviceId, trigger)
  }

  public async installService(serviceId: string, trigger: TriggerContext): Promise<void> {
    const elevated = this.getElevatedInjector()
    const services = await getRepository(elevated)
      .getDataSetFor(ServiceDefinition, 'id')
      .find(elevated, { filter: { id: { $eq: serviceId } }, top: 1 })
    const svc = services[0]
    if (!svc?.installCommand) throw new Error(`No install command for service: ${serviceId}`)

    const cwd = await resolveServiceCwd(getInjectorReference(this), svc, elevated)
    await this.runOneShot(serviceId, svc.installCommand, cwd, 'install', trigger)
  }

  public async buildService(serviceId: string, trigger: TriggerContext): Promise<void> {
    const elevated = this.getElevatedInjector()
    const services = await getRepository(elevated)
      .getDataSetFor(ServiceDefinition, 'id')
      .find(elevated, { filter: { id: { $eq: serviceId } }, top: 1 })
    const svc = services[0]
    if (!svc?.buildCommand) throw new Error(`No build command for service: ${serviceId}`)

    const cwd = await resolveServiceCwd(getInjectorReference(this), svc, elevated)
    await this.runOneShot(serviceId, svc.buildCommand, cwd, 'build', trigger)
  }

  private async runOneShot(
    serviceId: string,
    command: string,
    cwd: string,
    purpose: 'install' | 'build',
    trigger: TriggerContext,
  ): Promise<void> {
    if (this.processes.has(serviceId) || this.pendingOperations.has(serviceId)) {
      const existing = this.processes.get(serviceId)
      throw new Error(
        `Service ${serviceId} already has a ${existing?.purpose ?? purpose} process running. Stop it before starting a ${purpose}.`,
      )
    }

    this.pendingOperations.add(serviceId)

    const progressEvent: ServiceStateEvent = purpose === 'install' ? 'install-started' : 'build-started'
    const doneEvent: ServiceStateEvent = purpose === 'install' ? 'install-completed' : 'build-completed'
    const failedEvent: ServiceStateEvent = purpose === 'install' ? 'install-failed' : 'build-failed'

    const progressStatus =
      purpose === 'install' ? ({ installStatus: 'installing' } as const) : ({ buildStatus: 'building' } as const)

    const doneStatus =
      purpose === 'install' ? ({ installStatus: 'installed' } as const) : ({ buildStatus: 'built' } as const)

    const failedStatus =
      purpose === 'install' ? ({ installStatus: 'failed' } as const) : ({ buildStatus: 'failed' } as const)

    await this.updateServiceStatus(serviceId, progressStatus, progressEvent, trigger)

    const child = this.spawnCommand(command, cwd)
    const processUid = randomUUID()

    const managed: ManagedProcess = {
      serviceId,
      process: child,
      purpose,
      processUid,
    }
    this.processes.set(serviceId, managed)
    this.pendingOperations.delete(serviceId)

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
        void this.updateServiceStatus(serviceId, failedStatus, failedEvent, trigger, { error: err.message })
        this.processes.delete(serviceId)
        reject(err)
      })

      child.on('exit', (code) => {
        this.processes.delete(serviceId)
        if (code === 0) {
          void this.updateServiceStatus(serviceId, doneStatus, doneEvent, trigger)
          resolve()
        } else {
          void this.updateServiceStatus(serviceId, failedStatus, failedEvent, trigger, { exitCode: code })
          reject(new Error(`${purpose} command exited with code ${code}`))
        }
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
    try {
      await this.elevatedInjector?.[Symbol.asyncDispose]()
    } catch {
      // May already be disposed by the parent injector
    }
    await this.logger.information({ message: 'Disposing ProcessManager, killing all child processes...' })

    const entries = [...this.processes.entries()]
    if (entries.length === 0) return

    for (const [serviceId, managed] of entries) {
      managed.process.kill('SIGTERM')
      void this.logger.information({ message: `Sent SIGTERM to service: ${serviceId}` })
    }

    await Promise.all(
      entries.map(
        ([serviceId, managed]) =>
          new Promise<void>((resolve) => {
            const timeout = setTimeout(() => {
              if (!managed.process.killed) {
                managed.process.kill('SIGKILL')
                void this.logger.warning({ message: `Sent SIGKILL to service: ${serviceId}` })
              }
              resolve()
            }, 5000)

            managed.process.on('exit', () => {
              clearTimeout(timeout)
              resolve()
            })
          }),
      ),
    )

    this.processes.clear()
  }
}
