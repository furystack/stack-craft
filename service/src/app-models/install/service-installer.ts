import { Injectable, Injected, getInjectorReference } from '@furystack/inject'
import { LoggerCollection } from '@furystack/logging'
import { getRepository } from '@furystack/repository'
import { PasswordAuthenticator, PasswordCredential } from '@furystack/security'
import type { ServiceStatus } from 'common'
import { User } from 'common'

import { useSystemIdentityContext } from '@furystack/core'

@Injectable()
export class ServiceStatusProvider {
  public async getStatus(): Promise<ServiceStatus> {
    const elevated = useSystemIdentityContext({ injector: getInjectorReference(this) })
    try {
      const userCount = await getRepository(elevated).getDataSetFor(User, 'username').count(elevated)
      return userCount > 0 ? 'installed' : 'needsInstall'
    } finally {
      await elevated[Symbol.asyncDispose]()
    }
  }

  public async install(username: string, password: string): Promise<void> {
    const status = await this.getStatus()
    if (status === 'installed') {
      throw Error('Service is already installed')
    }
    const elevated = useSystemIdentityContext({ injector: getInjectorReference(this) })
    try {
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
    } finally {
      await elevated[Symbol.asyncDispose]()
    }
  }

  @Injected(PasswordAuthenticator)
  declare private authenticator: PasswordAuthenticator

  @Injected(LoggerCollection)
  declare private logger: LoggerCollection
}
