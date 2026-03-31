import { Injectable, Injected, type Injector, getInjectorReference } from '@furystack/inject'
import { LoggerCollection } from '@furystack/logging'
import { getRepository } from '@furystack/repository'
import { PasswordAuthenticator, PasswordCredential } from '@furystack/security'
import type { InstallState } from 'common'
import { User } from 'common'

import { useSystemIdentityContext } from '@furystack/core'

@Injectable({ lifetime: 'singleton' })
export class ServiceStatusProvider {
  private elevatedInjector?: Injector

  private getElevatedInjector(): Injector {
    if (!this.elevatedInjector) {
      this.elevatedInjector = useSystemIdentityContext({ injector: getInjectorReference(this) })
    }
    return this.elevatedInjector
  }

  public async getStatus(): Promise<InstallState> {
    const elevated = this.getElevatedInjector()
    const userCount = await getRepository(elevated).getDataSetFor(User, 'username').count(elevated)
    return userCount > 0 ? 'installed' : 'needsInstall'
  }

  public async install(username: string, password: string): Promise<void> {
    const status = await this.getStatus()
    if (status === 'installed') {
      throw Error('Service is already installed')
    }
    const elevated = this.getElevatedInjector()
    const repository = getRepository(elevated)
    await repository.getDataSetFor(User, 'username').add(elevated, {
      username,
      roles: ['admin'],
    })
    const credential = await this.authenticator.hasher.createCredential(username, password)
    await repository.getDataSetFor(PasswordCredential, 'userName').add(elevated, credential)
    await this.logger
      .withScope(this.constructor.name)
      .information({ message: `Service installed for user '${username}'` })
  }

  @Injected(PasswordAuthenticator)
  declare private authenticator: PasswordAuthenticator

  @Injected(LoggerCollection)
  declare private logger: LoggerCollection

  public async [Symbol.asyncDispose]() {
    try {
      await this.elevatedInjector?.[Symbol.asyncDispose]()
    } catch {
      // May already be disposed by the parent injector
    }
  }
}
