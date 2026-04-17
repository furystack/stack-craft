import { Injectable, Injected, type Injector, getInjectorReference } from '@furystack/inject'
import { getLogger } from '@furystack/logging'
import { getRepository } from '@furystack/repository'
import { ServiceDependencyLink, ServiceStatus } from 'common'

import { useSystemIdentityContext } from '@furystack/core'
import { ValidationError } from '../utils/domain-error.js'
import { getServiceOrThrow } from '../utils/get-service-or-throw.js'
import { GitOperationsService } from './git-operations-service.js'
import { OneShotCommandRunner } from './one-shot-command-runner.js'
import { ServiceLifecycleManager } from './service-lifecycle-manager.js'
import { computeExecutionLevels } from './service-graph-resolver.js'
import { ServiceStatusManager } from './service-status-manager.js'
import type { TriggerContext } from './trigger-context.js'

/** Orchestrates multi-step service workflows (setup, update, batch setup with dependency ordering) */
@Injectable({ lifetime: 'singleton' })
export class ServicePipelineOrchestrator {
  private elevatedInjector?: Injector

  private getElevatedInjector(): Injector {
    if (!this.elevatedInjector) {
      this.elevatedInjector = useSystemIdentityContext({ injector: getInjectorReference(this) })
    }
    return this.elevatedInjector
  }

  @Injected((injector) => getLogger(injector).withScope('ServicePipelineOrchestrator'))
  declare private logger: ReturnType<ReturnType<typeof getLogger>['withScope']>

  @Injected(ServiceLifecycleManager)
  declare private lifecycle: ServiceLifecycleManager

  @Injected(OneShotCommandRunner)
  declare private oneShotRunner: OneShotCommandRunner

  @Injected(GitOperationsService)
  declare private gitOps: GitOperationsService

  @Injected(ServiceStatusManager)
  declare private statusManager: ServiceStatusManager

  /**
   * Runs the full setup pipeline for a service: clone -> install -> build.
   * Skips steps that don't apply (e.g. no repo, no installCommand).
   * Stops on first failure.
   */
  public async setupService(serviceId: string, trigger: TriggerContext): Promise<void> {
    const elevated = this.getElevatedInjector()
    const svc = await getServiceOrThrow(serviceId, elevated)

    await this.statusManager.updateServiceStatus(serviceId, {}, 'setup-started', trigger)

    try {
      if (svc.repositoryId) {
        const statuses = await getRepository(elevated)
          .getDataSetFor(ServiceStatus, 'serviceId')
          .find(elevated, { filter: { serviceId: { $eq: serviceId } }, top: 1 })
        const currentStatus = statuses[0]
        if (currentStatus?.cloneStatus !== 'cloned') {
          await this.gitOps.cloneOrPullService(serviceId, trigger)
        }
      }

      if (svc.installCommand) {
        await this.oneShotRunner.installService(serviceId, trigger)
      }

      if (svc.buildCommand) {
        await this.oneShotRunner.buildService(serviceId, trigger)
      }

      await this.statusManager.updateServiceStatus(serviceId, {}, 'setup-completed', trigger)
    } catch (error) {
      await this.statusManager.updateServiceStatus(serviceId, {}, 'setup-failed', trigger, {
        error: error instanceof Error ? error.message : 'Setup failed',
      })
      throw error
    }
  }

  /**
   * Pulls latest changes, then re-installs, re-builds, and restarts (if it was running).
   * Skips install/build/restart if git pull reported no changes.
   */
  public async updateService(serviceId: string, trigger: TriggerContext): Promise<void> {
    const elevated = this.getElevatedInjector()
    const svc = await getServiceOrThrow(serviceId, elevated)

    const statuses = await getRepository(elevated)
      .getDataSetFor(ServiceStatus, 'serviceId')
      .find(elevated, { filter: { serviceId: { $eq: serviceId } }, top: 1 })
    const currentStatus = statuses[0]

    await this.statusManager.updateServiceStatus(serviceId, {}, 'update-started', trigger)

    try {
      if (!svc.repositoryId) {
        throw new ValidationError('No repository linked to this service')
      }

      const { updated } = await this.gitOps.cloneOrPullService(serviceId, trigger)

      if (!updated) {
        await this.statusManager.updateServiceStatus(serviceId, {}, 'update-completed', trigger, {
          message: 'Already up to date',
        })
        return
      }

      const wasRunning = currentStatus?.runStatus === 'running'

      if (wasRunning) {
        await this.lifecycle.stopService(serviceId, trigger)
      }

      if (svc.installCommand) {
        await this.oneShotRunner.installService(serviceId, trigger)
      }

      if (svc.buildCommand) {
        await this.oneShotRunner.buildService(serviceId, trigger)
      }

      if (wasRunning) {
        await this.lifecycle.startService(serviceId, trigger)
      }

      await this.statusManager.updateServiceStatus(serviceId, {}, 'update-completed', trigger)
    } catch (error) {
      await this.statusManager.updateServiceStatus(serviceId, {}, 'update-failed', trigger, {
        error: error instanceof Error ? error.message : 'Update failed',
      })
      throw error
    }
  }

  /**
   * Sets up multiple services respecting prerequisite dependencies.
   * Uses topological sort to determine execution order.
   */
  public async setupServices(serviceIds: string[], trigger: TriggerContext): Promise<void> {
    const elevated = this.getElevatedInjector()
    const repository = getRepository(elevated)

    const depLinks = await repository.getDataSetFor(ServiceDependencyLink, 'id').find(elevated, {})
    const dependencyMap = new Map<string, string[]>()
    for (const link of depLinks) {
      const deps = dependencyMap.get(link.serviceId) ?? []
      deps.push(link.dependsOnServiceId)
      dependencyMap.set(link.serviceId, deps)
    }

    const targetSet = new Set(serviceIds)
    const levels = computeExecutionLevels(serviceIds, dependencyMap, targetSet)

    for (const level of levels) {
      const results = await Promise.allSettled(level.map((id) => this.setupService(id, trigger)))
      const failures = results.filter((r): r is PromiseRejectedResult => r.status === 'rejected')
      if (failures.length > 0) {
        await this.logger.warning({
          message: `${failures.length} service(s) failed setup in batch level`,
          data: { errors: failures.map((f) => (f.reason as Error).message) },
        })
      }
    }
  }

  public async [Symbol.asyncDispose]() {
    try {
      await this.elevatedInjector?.[Symbol.asyncDispose]()
    } catch {
      // May already be disposed by the parent injector
    }
  }
}
