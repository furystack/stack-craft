import { useSystemIdentityContext } from '@furystack/core'
import { defineService, type Injector, type Token } from '@furystack/inject'
import { type Logger, LoggerCollection } from '@furystack/logging'
import { PasswordAuthenticator } from '@furystack/security'
import type { InstallState } from 'common'

import { PasswordCredentialDataSet, UserDataSet } from '../data-store/tokens.js'

class ServiceStatusProviderImpl {
  private elevatedInjector?: Injector

  constructor(
    private readonly authenticator: PasswordAuthenticator,
    private readonly logger: Logger,
    public readonly injector: Injector,
  ) {}

  private getElevatedInjector(): Injector {
    if (!this.elevatedInjector) {
      this.elevatedInjector = useSystemIdentityContext({ injector: this.injector })
    }
    return this.elevatedInjector
  }

  public async getStatus(): Promise<InstallState> {
    const elevated = this.getElevatedInjector()
    const userCount = await elevated.get(UserDataSet).count(elevated)
    return userCount > 0 ? 'installed' : 'needsInstall'
  }

  public async install(username: string, password: string): Promise<void> {
    const status = await this.getStatus()
    if (status === 'installed') {
      throw Error('Service is already installed')
    }
    const elevated = this.getElevatedInjector()
    await elevated.get(UserDataSet).add(elevated, { username, roles: ['admin'] })
    const credential = await this.authenticator.hasher.createCredential(username, password)
    await elevated.get(PasswordCredentialDataSet).add(elevated, credential)
    await this.logger
      .withScope(this.constructor.name)
      .information({ message: `Service installed for user '${username}'` })
  }

  public async [Symbol.asyncDispose]() {
    try {
      await this.elevatedInjector?.[Symbol.asyncDispose]()
    } catch {
      // May already be disposed by the parent injector
    }
  }
}

export type ServiceStatusProvider = ServiceStatusProviderImpl

export const ServiceStatusProvider: Token<ServiceStatusProvider, 'singleton'> = defineService({
  name: 'app/ServiceStatusProvider',
  lifetime: 'singleton',
  factory: ({ inject, injector }) =>
    new ServiceStatusProviderImpl(inject(PasswordAuthenticator), inject(LoggerCollection), injector),
})
