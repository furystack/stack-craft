import { Injectable, Injected } from '@furystack/inject'

import { GitOperationsService } from './git-operations-service.js'
import { OneShotCommandRunner } from './one-shot-command-runner.js'
import { ServiceEnvResolver } from './service-env-resolver.js'
import { ServiceFileManager } from './service-file-manager.js'
import { ServiceLifecycleManager } from './service-lifecycle-manager.js'
import { ServicePipelineOrchestrator } from './service-pipeline-orchestrator.js'
import { StaleStateReconciler } from './stale-state-reconciler.js'

export type { TriggerContext } from './trigger-context.js'
import type { TriggerContext } from './trigger-context.js'

/**
 * Facade that delegates to focused service classes.
 * Kept for backward compatibility with REST actions, MCP tools, and other consumers.
 */
@Injectable({ lifetime: 'singleton' })
export class ProcessManager {
  @Injected(ServiceLifecycleManager)
  declare private lifecycle: ServiceLifecycleManager

  @Injected(OneShotCommandRunner)
  declare private oneShotRunner: OneShotCommandRunner

  @Injected(ServiceFileManager)
  declare private fileManager: ServiceFileManager

  @Injected(ServicePipelineOrchestrator)
  declare private pipeline: ServicePipelineOrchestrator

  @Injected(GitOperationsService)
  declare private gitOps: GitOperationsService

  @Injected(ServiceEnvResolver)
  declare private envResolver: ServiceEnvResolver

  @Injected(StaleStateReconciler)
  declare private reconciler: StaleStateReconciler

  public async startService(serviceId: string, trigger: TriggerContext): Promise<void> {
    return this.lifecycle.startService(serviceId, trigger)
  }

  public async stopService(serviceId: string, trigger: TriggerContext): Promise<void> {
    return this.lifecycle.stopService(serviceId, trigger)
  }

  public async restartService(serviceId: string, trigger: TriggerContext): Promise<void> {
    return this.lifecycle.restartService(serviceId, trigger)
  }

  public async installService(serviceId: string, trigger: TriggerContext): Promise<void> {
    return this.oneShotRunner.installService(serviceId, trigger)
  }

  public async buildService(serviceId: string, trigger: TriggerContext): Promise<void> {
    return this.oneShotRunner.buildService(serviceId, trigger)
  }

  public async cloneOrPullService(
    serviceId: string,
    trigger: TriggerContext,
  ): Promise<{ cloned: boolean; pulled: boolean; updated: boolean }> {
    return this.gitOps.cloneOrPullService(serviceId, trigger)
  }

  public async applyFiles(serviceId: string, relativePath?: string): Promise<string[]> {
    return this.fileManager.applyFiles(serviceId, relativePath)
  }

  public async setupService(serviceId: string, trigger: TriggerContext): Promise<void> {
    return this.pipeline.setupService(serviceId, trigger)
  }

  public async updateService(serviceId: string, trigger: TriggerContext): Promise<void> {
    return this.pipeline.updateService(serviceId, trigger)
  }

  public async setupServices(serviceIds: string[], trigger: TriggerContext): Promise<void> {
    return this.pipeline.setupServices(serviceIds, trigger)
  }

  public async resolveServiceEnvVars(serviceId: string): Promise<Record<string, string>> {
    return this.envResolver.resolveServiceEnvVars(serviceId)
  }

  public async reconcileStaleStates(): Promise<void> {
    return this.reconciler.reconcileStaleStates()
  }

  public async [Symbol.asyncDispose]() {
    await this.lifecycle[Symbol.asyncDispose]()
  }
}
