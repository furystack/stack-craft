import { useSystemIdentityContext } from '@furystack/core'
import { type Injector, defineService, type Token } from '@furystack/inject'
import type { EnvironmentVariableValue } from 'common'
import { Prerequisite, ServiceConfig, ServiceDefinition, ServicePrerequisiteLink, StackConfig } from 'common'

import { CryptoService } from '../utils/crypto-service.js'
import { legacyRepository as getRepository } from '../utils/legacy-repository.js'

/**
 * Resolves the effective environment variables for a service by looking up
 * its env-variable prerequisites and merging stack-level defaults with
 * optional service-level overrides.
 */
class ServiceEnvResolverImpl {
  constructor(public readonly injector: Injector) {}

  private elevatedInjector?: Injector

  private getElevatedInjector(): Injector {
    if (!this.elevatedInjector) {
      this.elevatedInjector = useSystemIdentityContext({ injector: this.injector })
    }
    return this.elevatedInjector
  }

  private resolveEnvValue(
    varName: string,
    config: EnvironmentVariableValue | undefined,
    resolved: Record<string, string>,
  ): void {
    if (config?.source === 'custom' && config.customValue !== undefined) {
      const crypto = this.getElevatedInjector().get(CryptoService)
      resolved[varName] = crypto.isEncrypted(config.customValue)
        ? crypto.decrypt(config.customValue)
        : config.customValue
    } else if (config?.source === 'inherit' || !config) {
      const globalValue = process.env[varName]
      if (globalValue !== undefined) {
        resolved[varName] = globalValue
      }
    }
  }

  public async resolveServiceEnvVars(serviceId: string): Promise<Record<string, string>> {
    const elevated = this.getElevatedInjector()
    const repository = getRepository(elevated)

    const services = await repository
      .getDataSetFor(ServiceDefinition, 'id')
      .find(elevated, { filter: { id: { $eq: serviceId } }, top: 1 })
    const svc = services[0]
    if (!svc) return {}

    const prereqLinks = await repository
      .getDataSetFor(ServicePrerequisiteLink, 'id')
      .find(elevated, { filter: { serviceId: { $eq: serviceId } } })
    const linkedPrereqIds = new Set(prereqLinks.map((l) => l.prerequisiteId))

    const allPrereqs = await repository
      .getDataSetFor(Prerequisite, 'id')
      .find(elevated, { filter: { stackName: { $eq: svc.stackName } } })
    const envPrereqs = allPrereqs.filter((p) => p.type === 'env-variable' && linkedPrereqIds.has(p.id))

    const stackConfigs = await repository
      .getDataSetFor(StackConfig, 'stackName')
      .find(elevated, { filter: { stackName: { $eq: svc.stackName } }, top: 1 })
    const stackConfig = stackConfigs[0]

    const svcConfigs = await repository
      .getDataSetFor(ServiceConfig, 'serviceId')
      .find(elevated, { filter: { serviceId: { $eq: serviceId } }, top: 1 })
    const svcConfig = svcConfigs[0]

    const resolved: Record<string, string> = {}

    for (const prereq of envPrereqs) {
      const varName = (prereq.config as { variableName: string }).variableName
      const override = svcConfig?.environmentVariableOverrides?.[varName]
      const stackDefault = stackConfig?.environmentVariables?.[varName]
      this.resolveEnvValue(varName, override ?? stackDefault, resolved)
    }

    const resolvedKeys = new Set(Object.keys(resolved))
    const freeFormKeys = new Set([
      ...Object.keys(stackConfig?.environmentVariables ?? {}),
      ...Object.keys(svcConfig?.environmentVariableOverrides ?? {}),
    ])
    for (const varName of freeFormKeys) {
      if (resolvedKeys.has(varName)) continue
      const override = svcConfig?.environmentVariableOverrides?.[varName]
      const stackDefault = stackConfig?.environmentVariables?.[varName]
      this.resolveEnvValue(varName, override ?? stackDefault, resolved)
    }

    return resolved
  }

  public async [Symbol.asyncDispose]() {
    try {
      await this.elevatedInjector?.[Symbol.asyncDispose]()
    } catch {
      // May already be disposed by the parent injector
    }
  }
}

export type ServiceEnvResolver = ServiceEnvResolverImpl

export const ServiceEnvResolver: Token<ServiceEnvResolver, 'singleton'> = defineService({
  name: 'app/ServiceEnvResolver',
  lifetime: 'singleton',
  factory: ({ injector }) => new ServiceEnvResolverImpl(injector),
})
