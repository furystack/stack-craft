import type { Injector } from '@furystack/inject'
import { addStore, InMemoryStore } from '@furystack/core'
import { getLogger } from '@furystack/logging'
import { getRepository } from '@furystack/repository'
import { useSequelize } from '@furystack/sequelize-store'
import { DefaultSession } from '@furystack/rest-service'
import { PasswordCredential, PasswordResetToken } from '@furystack/security'
import {
  ApiToken,
  GitHubRepository,
  Prerequisite,
  PrerequisiteCheckResult,
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

import { authorizedDataSet } from '../../config.js'
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

const registerSequelizeStores = (injector: Injector, dbOptions: ReturnType<typeof getDbOptions>) => {
  let initPromise: Promise<void> | null = null
  const initOnce = async (sequelize: Sequelize) => {
    if (!initPromise) {
      initPromise = initAllModels(sequelize)
    }
    await initPromise
  }

  useSequelize({
    injector,
    model: User,
    sequelizeModel: UserModel,
    primaryKey: 'username',
    options: dbOptions,
    initModel: initOnce,
  })
  useSequelize({
    injector,
    model: PasswordCredential,
    sequelizeModel: PasswordCredentialModel,
    primaryKey: 'userName',
    options: dbOptions,
    initModel: initOnce,
  })
  useSequelize({
    injector,
    model: StackDefinition,
    sequelizeModel: StackDefinitionModel,
    primaryKey: 'name',
    options: dbOptions,
    initModel: initOnce,
  })
  useSequelize({
    injector,
    model: StackConfig,
    sequelizeModel: StackConfigModel,
    primaryKey: 'stackName',
    options: dbOptions,
    initModel: initOnce,
  })
  useSequelize({
    injector,
    model: GitHubRepository,
    sequelizeModel: GitHubRepositoryModel,
    primaryKey: 'id',
    options: dbOptions,
    initModel: initOnce,
  })
  useSequelize({
    injector,
    model: Prerequisite,
    sequelizeModel: PrerequisiteModel,
    primaryKey: 'id',
    options: dbOptions,
    initModel: initOnce,
  })
  useSequelize({
    injector,
    model: ServiceDefinition,
    sequelizeModel: ServiceDefinitionModel,
    primaryKey: 'id',
    options: dbOptions,
    initModel: initOnce,
  })
  useSequelize({
    injector,
    model: ServiceConfig,
    sequelizeModel: ServiceConfigModel,
    primaryKey: 'serviceId',
    options: dbOptions,
    initModel: initOnce,
  })
  useSequelize({
    injector,
    model: ServiceStatus,
    sequelizeModel: ServiceStatusModel,
    primaryKey: 'serviceId',
    options: dbOptions,
    initModel: initOnce,
  })
  useSequelize({
    injector,
    model: ServiceStateHistory,
    sequelizeModel: ServiceStateHistoryModel,
    primaryKey: 'id',
    options: dbOptions,
    initModel: initOnce,
  })
  useSequelize({
    injector,
    model: ApiToken,
    sequelizeModel: ApiTokenModel,
    primaryKey: 'id',
    options: dbOptions,
    initModel: initOnce,
  })
  useSequelize({
    injector,
    model: DefaultSession,
    sequelizeModel: DefaultSessionModel,
    primaryKey: 'sessionId',
    options: dbOptions,
    initModel: initOnce,
  })
  useSequelize({
    injector,
    model: PasswordResetToken,
    sequelizeModel: PasswordResetTokenModel,
    primaryKey: 'token',
    options: dbOptions,
    initModel: initOnce,
  })
  useSequelize({
    injector,
    model: ServicePrerequisiteLink,
    sequelizeModel: ServicePrerequisiteLinkModel,
    primaryKey: 'id',
    options: dbOptions,
    initModel: initOnce,
  })
  useSequelize({
    injector,
    model: ServiceDependencyLink,
    sequelizeModel: ServiceDependencyLinkModel,
    primaryKey: 'id',
    options: dbOptions,
    initModel: initOnce,
  })
}

const registerDataSets = (injector: Injector) => {
  const repo = getRepository(injector)
  repo.createDataSet(User, 'username', { ...authorizedDataSet })
  repo.createDataSet(PasswordCredential, 'userName', { ...authorizedDataSet })
  repo.createDataSet(StackDefinition, 'name', { ...authorizedDataSet })
  repo.createDataSet(StackConfig, 'stackName', { ...authorizedDataSet })
  repo.createDataSet(GitHubRepository, 'id', { ...authorizedDataSet })
  repo.createDataSet(Prerequisite, 'id', { ...authorizedDataSet })
  repo.createDataSet(ServiceDefinition, 'id', { ...authorizedDataSet })
  repo.createDataSet(ServiceConfig, 'serviceId', { ...authorizedDataSet })
  repo.createDataSet(ServiceStatus, 'serviceId', { ...authorizedDataSet })
  repo.createDataSet(ServiceStateHistory, 'id', { ...authorizedDataSet })
  repo.createDataSet(ApiToken, 'id', { ...authorizedDataSet })
  repo.createDataSet(DefaultSession, 'sessionId')
  repo.createDataSet(PasswordResetToken, 'token')
  repo.createDataSet(ServicePrerequisiteLink, 'id', { ...authorizedDataSet })
  repo.createDataSet(ServiceDependencyLink, 'id', { ...authorizedDataSet })
  repo.createDataSet(PrerequisiteCheckResult, 'prerequisiteId', { ...authorizedDataSet })

  addStore(injector, new InMemoryStore({ model: ServiceGitStatus, primaryKey: 'serviceId' }))
  repo.createDataSet(ServiceGitStatus, 'serviceId', { ...authorizedDataSet })
}

export const setupDataStore = async (injector: Injector) => {
  const logger = getLogger(injector).withScope('DataStore')
  const dbOptions = getDbOptions()

  registerSequelizeStores(injector, dbOptions)
  registerDataSets(injector)

  await logger.information({ message: 'Data store initialized' })
}
