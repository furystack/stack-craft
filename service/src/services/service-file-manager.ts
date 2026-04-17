import { Injectable, Injected, type Injector, getInjectorReference } from '@furystack/inject'
import { getRepository } from '@furystack/repository'
import { ServiceConfig } from 'common'

import { useSystemIdentityContext } from '@furystack/core'
import { applyServiceFiles, mergeServiceFiles } from '../utils/apply-service-files.js'
import { CryptoService } from '../utils/crypto-service.js'
import { NotFoundError } from '../utils/domain-error.js'
import { decryptLocalFiles } from '../utils/env-encryption-helpers.js'
import { getServiceOrThrow } from '../utils/get-service-or-throw.js'
import { resolveServiceCwd } from '../utils/resolve-service-cwd.js'
import { ServiceEnvResolver } from './service-env-resolver.js'

/** Applies shared and local service files to disk, merging and decrypting as needed */
@Injectable({ lifetime: 'singleton' })
export class ServiceFileManager {
  private elevatedInjector?: Injector

  private getElevatedInjector(): Injector {
    if (!this.elevatedInjector) {
      this.elevatedInjector = useSystemIdentityContext({ injector: getInjectorReference(this) })
    }
    return this.elevatedInjector
  }

  @Injected(ServiceEnvResolver)
  declare private envResolver: ServiceEnvResolver

  /**
   * Manually applies shared files for a service to disk.
   * @param relativePath - If provided, only the file matching this path is applied
   * @returns The list of relative paths that were written
   */
  public async applyFiles(serviceId: string, relativePath?: string): Promise<string[]> {
    const elevated = this.getElevatedInjector()
    const crypto = elevated.getInstance(CryptoService)
    const repository = getRepository(elevated)

    const svc = await getServiceOrThrow(serviceId, elevated)

    const svcConfigs = await repository
      .getDataSetFor(ServiceConfig, 'serviceId')
      .find(elevated, { filter: { serviceId: { $eq: serviceId } }, top: 1 })
    const localFiles = decryptLocalFiles(crypto, svcConfigs[0]?.localFiles ?? [])
    const merged = mergeServiceFiles(svc.files ?? [], localFiles)

    const cwd = await resolveServiceCwd(getInjectorReference(this), svc, elevated)

    if (relativePath) {
      const file = merged.find((f) => f.relativePath === relativePath)
      if (!file) throw new NotFoundError(`File not found in service definition or local files: ${relativePath}`)
    }

    const variables = await this.envResolver.resolveServiceEnvVars(serviceId)
    return applyServiceFiles(cwd, merged, relativePath, variables)
  }

  public async [Symbol.asyncDispose]() {
    try {
      await this.elevatedInjector?.[Symbol.asyncDispose]()
    } catch {
      // May already be disposed by the parent injector
    }
  }
}
