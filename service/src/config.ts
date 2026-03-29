import { addStore, InMemoryStore, isAuthenticated } from '@furystack/core'
import { Injector } from '@furystack/inject'
import { useLogging } from '@furystack/logging'

import { FilteredConsoleLogger } from './utils/filtered-console-logger.js'
import type { AuthorizationResult } from '@furystack/repository'
import { getRepository } from '@furystack/repository'
import { DefaultSession } from '@furystack/rest-service'
import { PasswordResetToken, usePasswordPolicy } from '@furystack/security'
import { PrerequisiteCheckResult, PublicApiToken } from 'common'

export const authorizedOnly = async (options: { injector: Injector }): Promise<AuthorizationResult> => {
  const isAllowed = await isAuthenticated(options.injector)
  return isAllowed
    ? { isAllowed }
    : {
        isAllowed,
        message: 'You are not authorized',
      }
}

export const authorizedDataSet = {
  authorizeAdd: authorizedOnly,
  authorizeGet: authorizedOnly,
  authorizeRemove: authorizedOnly,
  authorizeUpdate: authorizedOnly,
  authorizeRemoveEntity: authorizedOnly,
}

export const injector = new Injector()
useLogging(injector, FilteredConsoleLogger)

addStore(injector, new InMemoryStore({ model: DefaultSession, primaryKey: 'sessionId' }))
  .addStore(new InMemoryStore({ model: PublicApiToken, primaryKey: 'id' }))
  .addStore(new InMemoryStore({ model: PrerequisiteCheckResult, primaryKey: 'prerequisiteId' }))
  .addStore(new InMemoryStore({ model: PasswordResetToken, primaryKey: 'token' }))

getRepository(injector).createDataSet(DefaultSession, 'sessionId')
getRepository(injector).createDataSet(PublicApiToken, 'id', { ...authorizedDataSet })
getRepository(injector).createDataSet(PasswordResetToken, 'token')

usePasswordPolicy(injector)
