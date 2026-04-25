import { defineService, type Token } from '@furystack/inject'

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
class ProcessManagerImpl {
  constructor(
    private readonly lifecycle: ServiceLifecycleManager,
    private readonly oneShotRunner: OneShotCommandRunner,
    private readonly fileManager: ServiceFileManager,
    private readonly pipeline: ServicePipelineOrchestrator,
    private readonly gitOps: GitOperationsService,
    private readonly envResolver: ServiceEnvResolver,
    private readonly reconciler: StaleStateReconciler,
  ) {}

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

export type ProcessManager = ProcessManagerImpl

export const ProcessManager: Token<ProcessManager, 'singleton'> = defineService({
  name: 'app/ProcessManager',
  lifetime: 'singleton',
  factory: ({ inject }) =>
    new ProcessManagerImpl(
      inject(ServiceLifecycleManager),
      inject(OneShotCommandRunner),
      inject(ServiceFileManager),
      inject(ServicePipelineOrchestrator),
      inject(GitOperationsService),
      inject(ServiceEnvResolver),
      inject(StaleStateReconciler),
    ),
})
