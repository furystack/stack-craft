import { addStore, InMemoryStore, isAuthenticated } from '@furystack/core'
import { FileSystemStore } from '@furystack/filesystem-store'
import { Injector } from '@furystack/inject'
import { useLogging, VerboseConsoleLogger } from '@furystack/logging'
import type { AuthorizationResult } from '@furystack/repository'
import { getRepository } from '@furystack/repository'
import { DefaultSession } from '@furystack/rest-service'
import { PasswordCredential, usePasswordPolicy } from '@furystack/security'
import { ApiToken, Dependency, GitHubRepository, PublicApiToken, Service, Stack, User } from 'common'
import { mkdirSync } from 'fs'
import { join } from 'path'

const dataDir = process.env.STACK_CRAFT_DATA_DIR || join(process.cwd(), 'data')
mkdirSync(dataDir, { recursive: true })

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

addStore(
  injector,
  new FileSystemStore({
    model: User,
    primaryKey: 'username',
    tickMs: 30 * 1000,
    fileName: join(dataDir, 'users.json'),
  }),
)
  .addStore(
    new FileSystemStore({
      model: DefaultSession,
      primaryKey: 'sessionId',
      tickMs: 10 * 1000,
      fileName: join(dataDir, 'sessions.json'),
    }),
  )
  .addStore(
    new FileSystemStore({
      model: PasswordCredential,
      primaryKey: 'userName',
      fileName: join(dataDir, 'pwc.json'),
    }),
  )
  .addStore(
    new FileSystemStore({
      model: Stack,
      primaryKey: 'name',
      tickMs: 10 * 1000,
      fileName: join(dataDir, 'stacks.json'),
    }),
  )
  .addStore(
    new FileSystemStore({
      model: GitHubRepository,
      primaryKey: 'id',
      tickMs: 10 * 1000,
      fileName: join(dataDir, 'github-repositories.json'),
    }),
  )
  .addStore(
    new FileSystemStore({
      model: Dependency,
      primaryKey: 'id',
      tickMs: 10 * 1000,
      fileName: join(dataDir, 'dependencies.json'),
    }),
  )
  .addStore(
    new FileSystemStore({
      model: Service,
      primaryKey: 'id',
      tickMs: 10 * 1000,
      fileName: join(dataDir, 'services.json'),
    }),
  )
  .addStore(
    new FileSystemStore({
      model: ApiToken,
      primaryKey: 'id',
      tickMs: 10 * 1000,
      fileName: join(dataDir, 'api-tokens.json'),
    }),
  )
  .addStore(new InMemoryStore({ model: PublicApiToken, primaryKey: 'id' }))

getRepository(injector).createDataSet(User, 'username', { ...authorizedDataSet })
getRepository(injector).createDataSet(Stack, 'name', { ...authorizedDataSet })
getRepository(injector).createDataSet(GitHubRepository, 'id', { ...authorizedDataSet })
getRepository(injector).createDataSet(Dependency, 'id', { ...authorizedDataSet })
getRepository(injector).createDataSet(Service, 'id', { ...authorizedDataSet })
getRepository(injector).createDataSet(ApiToken, 'id', { ...authorizedDataSet })
getRepository(injector).createDataSet(PublicApiToken, 'id', { ...authorizedDataSet })

usePasswordPolicy(injector)
