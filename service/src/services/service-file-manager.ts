import { type Injector, defineService, type Token } from '@furystack/inject'
import { ServiceConfig } from 'common'

import { useSystemIdentityContext } from '@furystack/core'
import { applyServiceFiles, mergeServiceFiles } from '../utils/apply-service-files.js'
import { CryptoService } from '../utils/crypto-service.js'
import { NotFoundError } from '../utils/domain-error.js'
import { decryptLocalFiles } from '../utils/env-encryption-helpers.js'
import { getServiceOrThrow } from '../utils/get-service-or-throw.js'
import { resolveServiceCwd } from '../utils/resolve-service-cwd.js'
import { ServiceEnvResolver } from './service-env-resolver.js'
import { legacyRepository as getRepository } from '../utils/legacy-repository.js'

/** Applies shared and local service files to disk, merging and decrypting as needed */
class ServiceFileManagerImpl {
  constructor(
    private readonly envResolver: ServiceEnvResolver,
    public readonly injector: Injector,
  ) {}

  private elevatedInjector?: Injector

  private getElevatedInjector(): Injector {
    if (!this.elevatedInjector) {
      this.elevatedInjector = useSystemIdentityContext({ injector: this.injector })
    }
    return this.elevatedInjector
  }

  /**
   * Manually applies shared files for a service to disk.
   * @param relativePath - If provided, only the file matching this path is applied
   * @returns The list of relative paths that were written
   */
  public async applyFiles(serviceId: string, relativePath?: string): Promise<string[]> {
    const elevated = this.getElevatedInjector()
    const crypto = elevated.get(CryptoService)
    const repository = getRepository(elevated)

    const svc = await getServiceOrThrow(serviceId, elevated)

    const svcConfigs = await repository
      .getDataSetFor(ServiceConfig, 'serviceId')
      .find(elevated, { filter: { serviceId: { $eq: serviceId } }, top: 1 })
    const localFiles = decryptLocalFiles(crypto, svcConfigs[0]?.localFiles ?? [])
    const merged = mergeServiceFiles(svc.files ?? [], localFiles)

    const cwd = await resolveServiceCwd(this.injector, svc, elevated)

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

export type ServiceFileManager = ServiceFileManagerImpl

export const ServiceFileManager: Token<ServiceFileManager, 'singleton'> = defineService({
  name: 'app/ServiceFileManager',
  lifetime: 'singleton',
  factory: ({ inject, injector }) => new ServiceFileManagerImpl(inject(ServiceEnvResolver), injector),
})
