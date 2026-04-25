import { defineStore, InMemoryStore } from '@furystack/core'
import type { Injector } from '@furystack/inject'
import { defineDataSet } from '@furystack/repository'
import { DefaultSession, SessionStore, UserStore } from '@furystack/rest-service'
import {
  PasswordCredential,
  PasswordCredentialStore,
  PasswordResetToken,
  PasswordResetTokenStore,
} from '@furystack/security'
import { defineSequelizeStore } from '@furystack/sequelize-store'
import {
  ApiToken,
  GitHubRepository,
  Prerequisite,
  PrerequisiteCheckResult,
  PublicApiToken,
  ServiceConfig,
  ServiceDefinition,
  ServiceDependencyLink,
  ServiceGitStatus,
  ServicePrerequisiteLink,
  ServiceStateHistory,
  ServiceStatus,
  StackConfig,
  StackDefinition,
  User,
} from 'common'
import type { Sequelize } from 'sequelize'

import { authorizedDataSet } from '../../auth-data-set.js'
import { getDbOptions } from './db-options.js'
import { initAllModels } from './init-models.js'
import {
  ApiTokenModel,
  DefaultSessionModel,
  GitHubRepositoryModel,
  PasswordCredentialModel,
  PasswordResetTokenModel,
  PrerequisiteModel,
  ServiceConfigModel,
  ServiceDefinitionModel,
  ServiceDependencyLinkModel,
  ServicePrerequisiteLinkModel,
  ServiceStateHistoryModel,
  ServiceStatusModel,
  StackConfigModel,
  StackDefinitionModel,
  UserModel,
} from './models.js'

let initPromise: Promise<void> | null = null
const initOnce = async (sequelize: Sequelize): Promise<void> => {
  if (!initPromise) {
    initPromise = initAllModels(sequelize)
  }
  await initPromise
}

/**
 * Lazy proxy that defers the `DATABASE_URL` lookup until a property is read.
 *
 * `defineSequelizeStore` captures the supplied `options` object eagerly at
 * module import; the actual call to `getSequelizeClient(opts.options)` only
 * happens when the store factory runs. Tests that bind these store tokens
 * to in-memory implementations therefore never need `DATABASE_URL`, but
 * passing `dbOptions()` directly would throw at import time.
 */
const lazyDbOptions = new Proxy(
  {},
  {
    get: (_target, prop) => getDbOptions()[prop as keyof ReturnType<typeof getDbOptions>],
  },
)

const dbOptions = (): ReturnType<typeof getDbOptions> => lazyDbOptions

export const AppUserStore = defineSequelizeStore({
  name: 'app/UserStore',
  model: User,
  sequelizeModel: UserModel,
  primaryKey: 'username',
  options: dbOptions(),
  initModel: initOnce,
})

export const AppPasswordCredentialStore = defineSequelizeStore({
  name: 'app/PasswordCredentialStore',
  model: PasswordCredential,
  sequelizeModel: PasswordCredentialModel,
  primaryKey: 'userName',
  options: dbOptions(),
  initModel: initOnce,
})

export const AppPasswordResetTokenStore = defineSequelizeStore({
  name: 'app/PasswordResetTokenStore',
  model: PasswordResetToken,
  sequelizeModel: PasswordResetTokenModel,
  primaryKey: 'token',
  options: dbOptions(),
  initModel: initOnce,
})

export const AppSessionStore = defineSequelizeStore({
  name: 'app/SessionStore',
  model: DefaultSession,
  sequelizeModel: DefaultSessionModel,
  primaryKey: 'sessionId',
  options: dbOptions(),
  initModel: initOnce,
})

export const StackDefinitionStore = defineSequelizeStore({
  name: 'app/StackDefinitionStore',
  model: StackDefinition,
  sequelizeModel: StackDefinitionModel,
  primaryKey: 'name',
  options: dbOptions(),
  initModel: initOnce,
})

export const StackConfigStore = defineSequelizeStore({
  name: 'app/StackConfigStore',
  model: StackConfig,
  sequelizeModel: StackConfigModel,
  primaryKey: 'stackName',
  options: dbOptions(),
  initModel: initOnce,
})

export const GitHubRepositoryStore = defineSequelizeStore({
  name: 'app/GitHubRepositoryStore',
  model: GitHubRepository,
  sequelizeModel: GitHubRepositoryModel,
  primaryKey: 'id',
  options: dbOptions(),
  initModel: initOnce,
})

export const PrerequisiteStore = defineSequelizeStore({
  name: 'app/PrerequisiteStore',
  model: Prerequisite,
  sequelizeModel: PrerequisiteModel,
  primaryKey: 'id',
  options: dbOptions(),
  initModel: initOnce,
})

export const ServiceDefinitionStore = defineSequelizeStore({
  name: 'app/ServiceDefinitionStore',
  model: ServiceDefinition,
  sequelizeModel: ServiceDefinitionModel,
  primaryKey: 'id',
  options: dbOptions(),
  initModel: initOnce,
})

export const ServiceConfigStore = defineSequelizeStore({
  name: 'app/ServiceConfigStore',
  model: ServiceConfig,
  sequelizeModel: ServiceConfigModel,
  primaryKey: 'serviceId',
  options: dbOptions(),
  initModel: initOnce,
})

export const ServiceStatusStore = defineSequelizeStore({
  name: 'app/ServiceStatusStore',
  model: ServiceStatus,
  sequelizeModel: ServiceStatusModel,
  primaryKey: 'serviceId',
  options: dbOptions(),
  initModel: initOnce,
})

export const ServiceStateHistoryStore = defineSequelizeStore({
  name: 'app/ServiceStateHistoryStore',
  model: ServiceStateHistory,
  sequelizeModel: ServiceStateHistoryModel,
  primaryKey: 'id',
  options: dbOptions(),
  initModel: initOnce,
})

export const ApiTokenStore = defineSequelizeStore({
  name: 'app/ApiTokenStore',
  model: ApiToken,
  sequelizeModel: ApiTokenModel,
  primaryKey: 'id',
  options: dbOptions(),
  initModel: initOnce,
})

export const ServicePrerequisiteLinkStore = defineSequelizeStore({
  name: 'app/ServicePrerequisiteLinkStore',
  model: ServicePrerequisiteLink,
  sequelizeModel: ServicePrerequisiteLinkModel,
  primaryKey: 'id',
  options: dbOptions(),
  initModel: initOnce,
})

export const ServiceDependencyLinkStore = defineSequelizeStore({
  name: 'app/ServiceDependencyLinkStore',
  model: ServiceDependencyLink,
  sequelizeModel: ServiceDependencyLinkModel,
  primaryKey: 'id',
  options: dbOptions(),
  initModel: initOnce,
})

export const ServiceGitStatusStore = defineStore({
  name: 'app/ServiceGitStatusStore',
  model: ServiceGitStatus,
  primaryKey: 'serviceId',
  factory: () => new InMemoryStore({ model: ServiceGitStatus, primaryKey: 'serviceId' }),
})

export const PublicApiTokenStore = defineStore({
  name: 'app/PublicApiTokenStore',
  model: PublicApiToken,
  primaryKey: 'id',
  factory: () => new InMemoryStore({ model: PublicApiToken, primaryKey: 'id' }),
})

export const PrerequisiteCheckResultStore = defineStore({
  name: 'app/PrerequisiteCheckResultStore',
  model: PrerequisiteCheckResult,
  primaryKey: 'prerequisiteId',
  factory: () => new InMemoryStore({ model: PrerequisiteCheckResult, primaryKey: 'prerequisiteId' }),
})

export const UserDataSet = defineDataSet({
  name: 'app/UserDataSet',
  store: AppUserStore,
  settings: { ...authorizedDataSet },
})

export const PasswordCredentialDataSet = defineDataSet({
  name: 'app/PasswordCredentialDataSet',
  store: AppPasswordCredentialStore,
  settings: { ...authorizedDataSet },
})

export const PasswordResetTokenDataSet = defineDataSet({
  name: 'app/PasswordResetTokenDataSet',
  store: AppPasswordResetTokenStore,
})

export const SessionDataSet = defineDataSet({
  name: 'app/SessionDataSet',
  store: AppSessionStore,
})

export const StackDefinitionDataSet = defineDataSet({
  name: 'app/StackDefinitionDataSet',
  store: StackDefinitionStore,
  settings: { ...authorizedDataSet },
})

export const StackConfigDataSet = defineDataSet({
  name: 'app/StackConfigDataSet',
  store: StackConfigStore,
  settings: { ...authorizedDataSet },
})

export const GitHubRepositoryDataSet = defineDataSet({
  name: 'app/GitHubRepositoryDataSet',
  store: GitHubRepositoryStore,
  settings: { ...authorizedDataSet },
})

export const PrerequisiteDataSet = defineDataSet({
  name: 'app/PrerequisiteDataSet',
  store: PrerequisiteStore,
  settings: { ...authorizedDataSet },
})

export const ServiceDefinitionDataSet = defineDataSet({
  name: 'app/ServiceDefinitionDataSet',
  store: ServiceDefinitionStore,
  settings: { ...authorizedDataSet },
})

export const ServiceConfigDataSet = defineDataSet({
  name: 'app/ServiceConfigDataSet',
  store: ServiceConfigStore,
  settings: { ...authorizedDataSet },
})

export const ServiceStatusDataSet = defineDataSet({
  name: 'app/ServiceStatusDataSet',
  store: ServiceStatusStore,
  settings: { ...authorizedDataSet },
})

export const ServiceStateHistoryDataSet = defineDataSet({
  name: 'app/ServiceStateHistoryDataSet',
  store: ServiceStateHistoryStore,
  settings: { ...authorizedDataSet },
})

export const ApiTokenDataSet = defineDataSet({
  name: 'app/ApiTokenDataSet',
  store: ApiTokenStore,
  settings: { ...authorizedDataSet },
})

export const ServicePrerequisiteLinkDataSet = defineDataSet({
  name: 'app/ServicePrerequisiteLinkDataSet',
  store: ServicePrerequisiteLinkStore,
  settings: { ...authorizedDataSet },
})

export const ServiceDependencyLinkDataSet = defineDataSet({
  name: 'app/ServiceDependencyLinkDataSet',
  store: ServiceDependencyLinkStore,
  settings: { ...authorizedDataSet },
})

export const ServiceGitStatusDataSet = defineDataSet({
  name: 'app/ServiceGitStatusDataSet',
  store: ServiceGitStatusStore,
  settings: { ...authorizedDataSet },
})

export const PublicApiTokenDataSet = defineDataSet({
  name: 'app/PublicApiTokenDataSet',
  store: PublicApiTokenStore,
  settings: { ...authorizedDataSet },
})

export const PrerequisiteCheckResultDataSet = defineDataSet({
  name: 'app/PrerequisiteCheckResultDataSet',
  store: PrerequisiteCheckResultStore,
  settings: { ...authorizedDataSet },
})

/**
 * Binds the security and rest-service throw-by-default store tokens to the
 * persistent sequelize-backed implementations declared in this module.
 *
 * Must be called once at bootstrap before resolving anything that touches
 * authentication.
 */
export const bindAuthenticationStores = (injector: Injector): void => {
  injector.bind(UserStore, ({ inject }) => inject(AppUserStore))
  injector.bind(SessionStore, ({ inject }) => inject(AppSessionStore))
  injector.bind(PasswordCredentialStore, ({ inject }) => inject(AppPasswordCredentialStore))
  injector.bind(PasswordResetTokenStore, ({ inject }) => inject(AppPasswordResetTokenStore))
}
