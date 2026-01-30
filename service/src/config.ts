import { addStore, InMemoryStore, isAuthenticated } from '@furystack/core'
import { FileSystemStore } from '@furystack/filesystem-store'
import { Injector } from '@furystack/inject'
import { useLogging, VerboseConsoleLogger } from '@furystack/logging'
import type { AuthorizationResult, DataSetSettings } from '@furystack/repository'
import { getRepository } from '@furystack/repository'
import { DefaultSession } from '@furystack/rest-service'
import { PasswordCredential, usePasswordPolicy } from '@furystack/security'
import { User } from 'common'
import { join } from 'path'

export const authorizedOnly = async (options: { injector: Injector }): Promise<AuthorizationResult> => {
  const isAllowed = await isAuthenticated(options.injector)
  return isAllowed
    ? { isAllowed }
    : {
        isAllowed,
        message: 'You are not authorized :(',
      }
}

export const authorizedDataSet: Partial<DataSetSettings<any, any>> = {
  authorizeAdd: authorizedOnly,
  authorizeGet: authorizedOnly,
  authorizeRemove: authorizedOnly,
  authorizeUpdate: authorizedOnly,
  authorizeRemoveEntity: authorizedOnly,
}

export const injector = new Injector()
useLogging(injector, VerboseConsoleLogger)
addStore(
  injector,
  new FileSystemStore({
    model: User,
    primaryKey: 'username',
    tickMs: 30 * 1000,
    fileName: join(process.cwd(), 'users.json'),
  }),
)
  .addStore(new InMemoryStore({ model: DefaultSession, primaryKey: 'sessionId' }))
  .addStore(
    new FileSystemStore({
      model: PasswordCredential,
      primaryKey: 'userName',
      fileName: join(process.cwd(), '..', '..', 'pwc.json'),
    }),
  )

getRepository(injector).createDataSet(User, 'username', {
  ...authorizedDataSet,
})

usePasswordPolicy(injector)
