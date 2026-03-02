import { addStore, InMemoryStore, isAuthenticated } from '@furystack/core'
import { Injector } from '@furystack/inject'
import { useLogging, VerboseConsoleLogger } from '@furystack/logging'
import type { AuthorizationResult } from '@furystack/repository'
import { getRepository } from '@furystack/repository'
import { DefaultSession } from '@furystack/rest-service'
import { PasswordResetToken, usePasswordPolicy } from '@furystack/security'
import { PrerequisiteCheckResult, PublicApiToken } from 'common'
import { mkdirSync } from 'fs'
import { join } from 'path'

export const dataDir = process.env.STACK_CRAFT_DATA_DIR || join(process.cwd(), 'data')

export const ensureDataDir = () => {
  mkdirSync(dataDir, { recursive: true })
}

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
useLogging(injector, VerboseConsoleLogger)

addStore(injector, new InMemoryStore({ model: DefaultSession, primaryKey: 'sessionId' }))
  .addStore(new InMemoryStore({ model: PublicApiToken, primaryKey: 'id' }))
  .addStore(new InMemoryStore({ model: PrerequisiteCheckResult, primaryKey: 'prerequisiteId' }))
  .addStore(new InMemoryStore({ model: PasswordResetToken, primaryKey: 'token' }))

getRepository(injector).createDataSet(DefaultSession, 'sessionId')
getRepository(injector).createDataSet(PublicApiToken, 'id', { ...authorizedDataSet })
getRepository(injector).createDataSet(PasswordResetToken, 'token')

usePasswordPolicy(injector)
