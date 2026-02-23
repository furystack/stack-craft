import type { Injector } from '@furystack/inject'
import { getLogger } from '@furystack/logging'
import { getRepository } from '@furystack/repository'
import { useSequelize } from '@furystack/sequelize-store'
import { PasswordCredential } from '@furystack/security'
import {
  ApiToken,
  GitHubRepository,
  Prerequisite,
  ServiceConfig,
  ServiceDefinition,
  ServiceStateHistory,
  ServiceStatus,
  StackConfig,
  StackDefinition,
  User,
} from 'common'
import type { PrerequisiteConfig, PrerequisiteType } from 'common'
import { DataTypes, Model } from 'sequelize'
import type { Options, Sequelize } from 'sequelize'
import sqlite from 'sqlite3'
import { join } from 'path'

import { authorizedDataSet, dataDir, ensureDataDir } from '../../config.js'

// --- Sequelize Model classes ---

class StackDefinitionModel extends Model<StackDefinition, StackDefinition> implements StackDefinition {
  declare name: string
  declare displayName: string
  declare description: string
  declare createdAt: string
  declare updatedAt: string
}

class StackConfigModel extends Model<StackConfig, StackConfig> implements StackConfig {
  declare stackName: string
  declare mainDirectory: string
  declare createdAt: string
  declare updatedAt: string
}

class ServiceDefinitionModel extends Model<ServiceDefinition, ServiceDefinition> implements ServiceDefinition {
  declare id: string
  declare stackName: string
  declare displayName: string
  declare description: string
  declare workingDirectory: string | undefined
  declare repositoryId: string | undefined
  declare prerequisiteIds: string[]
  declare prerequisiteServiceIds: string[]
  declare installCommand: string | undefined
  declare buildCommand: string | undefined
  declare runCommand: string
  declare createdAt: string
  declare updatedAt: string
}

class ServiceConfigModel extends Model<ServiceConfig, ServiceConfig> implements ServiceConfig {
  declare serviceId: string
  declare autoFetchEnabled: boolean
  declare autoFetchIntervalMinutes: number
  declare autoRestartOnFetch: boolean
  declare createdAt: string
  declare updatedAt: string
}

class ServiceStatusModel extends Model<ServiceStatus, ServiceStatus> implements ServiceStatus {
  declare serviceId: string
  declare cloneStatus: ServiceStatus['cloneStatus']
  declare installStatus: ServiceStatus['installStatus']
  declare buildStatus: ServiceStatus['buildStatus']
  declare runStatus: ServiceStatus['runStatus']
  declare lastClonedAt: string | undefined
  declare lastInstalledAt: string | undefined
  declare lastBuiltAt: string | undefined
  declare lastStartedAt: string | undefined
  declare lastFetchedAt: string | undefined
  declare updatedAt: string
}

class ServiceStateHistoryModel extends Model<ServiceStateHistory, ServiceStateHistory> implements ServiceStateHistory {
  declare id: number
  declare serviceId: string
  declare event: ServiceStateHistory['event']
  declare previousState: string | undefined
  declare newState: string | undefined
  declare triggeredBy: string
  declare triggerSource: ServiceStateHistory['triggerSource']
  declare metadata: string | undefined
  declare processUid: string | undefined
  declare createdAt: string
}

class GitHubRepositoryModel extends Model<GitHubRepository, GitHubRepository> implements GitHubRepository {
  declare id: string
  declare stackName: string
  declare url: string
  declare displayName: string
  declare description: string
  declare createdAt: string
  declare updatedAt: string
}

class PrerequisiteModel extends Model<Prerequisite, Prerequisite> implements Prerequisite {
  declare id: string
  declare stackName: string
  declare name: string
  declare type: PrerequisiteType
  declare config: PrerequisiteConfig
  declare installationHelp: string
  declare createdAt: string
  declare updatedAt: string
}

class UserModel extends Model<User, User> implements User {
  declare username: string
  declare roles: string[]
}

class PasswordCredentialModel extends Model<PasswordCredential, PasswordCredential> implements PasswordCredential {
  declare userName: string
  declare passwordHash: string
  declare salt: string
  declare creationDate: string
}

class ApiTokenModel extends Model<ApiToken, ApiToken> implements ApiToken {
  declare id: string
  declare username: string
  declare name: string
  declare tokenHash: string
  declare lastUsedAt: string | undefined
  declare createdAt: string
}

const getDbOptions = (): Options => ({
  dialect: 'sqlite',
  dialectModule: sqlite,
  storage: join(dataDir, 'stack-craft.sqlite'),
  logging: false,
})

/**
 * Initializes ALL Sequelize models and their associations on the shared connection.
 * Called once via the first useSequelize's initModel callback.
 */
async function initAllModels(sequelize: Sequelize): Promise<void> {
  await sequelize.query('PRAGMA foreign_keys = ON')

  UserModel.init(
    {
      username: { type: DataTypes.STRING, primaryKey: true },
      roles: {
        type: DataTypes.TEXT,
        defaultValue: '[]',
        get() {
          const raw = this.getDataValue('roles')
          return typeof raw === 'string' ? (JSON.parse(raw) as string[]) : raw
        },
        set(val: string[]) {
          this.setDataValue('roles', JSON.stringify(val) as unknown as string[])
        },
      },
    },
    { sequelize, timestamps: false },
  )

  PasswordCredentialModel.init(
    {
      userName: {
        type: DataTypes.STRING,
        primaryKey: true,
        references: { model: UserModel, key: 'username' },
      },
      passwordHash: { type: DataTypes.STRING, allowNull: false },
      salt: { type: DataTypes.STRING, allowNull: false },
      creationDate: { type: DataTypes.STRING, allowNull: false },
    },
    { sequelize, timestamps: false },
  )

  StackDefinitionModel.init(
    {
      name: { type: DataTypes.STRING, primaryKey: true },
      displayName: { type: DataTypes.STRING, allowNull: false },
      description: { type: DataTypes.TEXT, defaultValue: '' },
      createdAt: { type: DataTypes.DATE },
      updatedAt: { type: DataTypes.DATE },
    },
    { sequelize },
  )

  StackConfigModel.init(
    {
      stackName: {
        type: DataTypes.STRING,
        primaryKey: true,
        references: { model: StackDefinitionModel, key: 'name' },
      },
      mainDirectory: { type: DataTypes.STRING, allowNull: false },
      createdAt: { type: DataTypes.DATE },
      updatedAt: { type: DataTypes.DATE },
    },
    { sequelize },
  )

  GitHubRepositoryModel.init(
    {
      id: { type: DataTypes.STRING, primaryKey: true },
      stackName: {
        type: DataTypes.STRING,
        allowNull: false,
        references: { model: StackDefinitionModel, key: 'name' },
      },
      url: { type: DataTypes.STRING, allowNull: false },
      displayName: { type: DataTypes.STRING, allowNull: false },
      description: { type: DataTypes.TEXT, defaultValue: '' },
      createdAt: { type: DataTypes.DATE },
      updatedAt: { type: DataTypes.DATE },
    },
    { sequelize, indexes: [{ fields: ['stackName'] }] },
  )

  PrerequisiteModel.init(
    {
      id: { type: DataTypes.STRING, primaryKey: true },
      stackName: {
        type: DataTypes.STRING,
        allowNull: false,
        references: { model: StackDefinitionModel, key: 'name' },
      },
      name: { type: DataTypes.STRING, allowNull: false },
      type: { type: DataTypes.STRING, allowNull: false },
      config: {
        type: DataTypes.TEXT,
        defaultValue: '{}',
        get() {
          const raw = this.getDataValue('config')
          return typeof raw === 'string' ? (JSON.parse(raw) as PrerequisiteConfig) : raw
        },
        set(val: PrerequisiteConfig) {
          this.setDataValue('config', JSON.stringify(val) as unknown as PrerequisiteConfig)
        },
      },
      installationHelp: { type: DataTypes.TEXT, defaultValue: '' },
      createdAt: { type: DataTypes.DATE },
      updatedAt: { type: DataTypes.DATE },
    },
    { sequelize, indexes: [{ fields: ['stackName'] }] },
  )

  ServiceDefinitionModel.init(
    {
      id: { type: DataTypes.STRING, primaryKey: true },
      stackName: {
        type: DataTypes.STRING,
        allowNull: false,
        references: { model: StackDefinitionModel, key: 'name' },
      },
      displayName: { type: DataTypes.STRING, allowNull: false },
      description: { type: DataTypes.TEXT, defaultValue: '' },
      workingDirectory: { type: DataTypes.STRING, allowNull: true },
      repositoryId: {
        type: DataTypes.STRING,
        allowNull: true,
        references: { model: GitHubRepositoryModel, key: 'id' },
      },
      prerequisiteIds: {
        type: DataTypes.TEXT,
        defaultValue: '[]',
        get() {
          const raw = this.getDataValue('prerequisiteIds')
          return typeof raw === 'string' ? (JSON.parse(raw) as string[]) : raw
        },
        set(val: string[]) {
          this.setDataValue('prerequisiteIds', JSON.stringify(val) as unknown as string[])
        },
      },
      prerequisiteServiceIds: {
        type: DataTypes.TEXT,
        defaultValue: '[]',
        get() {
          const raw = this.getDataValue('prerequisiteServiceIds')
          return typeof raw === 'string' ? (JSON.parse(raw) as string[]) : raw
        },
        set(val: string[]) {
          this.setDataValue('prerequisiteServiceIds', JSON.stringify(val) as unknown as string[])
        },
      },
      installCommand: { type: DataTypes.STRING, allowNull: true },
      buildCommand: { type: DataTypes.STRING, allowNull: true },
      runCommand: { type: DataTypes.STRING, allowNull: false },
      createdAt: { type: DataTypes.DATE },
      updatedAt: { type: DataTypes.DATE },
    },
    { sequelize, indexes: [{ fields: ['stackName'] }] },
  )

  ServiceConfigModel.init(
    {
      serviceId: {
        type: DataTypes.STRING,
        primaryKey: true,
        references: { model: ServiceDefinitionModel, key: 'id' },
      },
      autoFetchEnabled: { type: DataTypes.BOOLEAN, defaultValue: false },
      autoFetchIntervalMinutes: { type: DataTypes.INTEGER, defaultValue: 60 },
      autoRestartOnFetch: { type: DataTypes.BOOLEAN, defaultValue: false },
      createdAt: { type: DataTypes.DATE },
      updatedAt: { type: DataTypes.DATE },
    },
    { sequelize },
  )

  ServiceStatusModel.init(
    {
      serviceId: {
        type: DataTypes.STRING,
        primaryKey: true,
        references: { model: ServiceDefinitionModel, key: 'id' },
      },
      cloneStatus: { type: DataTypes.STRING, defaultValue: 'not-cloned' },
      installStatus: { type: DataTypes.STRING, defaultValue: 'not-installed' },
      buildStatus: { type: DataTypes.STRING, defaultValue: 'not-built' },
      runStatus: { type: DataTypes.STRING, defaultValue: 'stopped' },
      lastClonedAt: { type: DataTypes.DATE, allowNull: true },
      lastInstalledAt: { type: DataTypes.DATE, allowNull: true },
      lastBuiltAt: { type: DataTypes.DATE, allowNull: true },
      lastStartedAt: { type: DataTypes.DATE, allowNull: true },
      lastFetchedAt: { type: DataTypes.DATE, allowNull: true },
      updatedAt: { type: DataTypes.DATE },
    },
    { sequelize, createdAt: false },
  )

  ServiceStateHistoryModel.init(
    {
      id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
      serviceId: {
        type: DataTypes.STRING,
        allowNull: false,
        references: { model: ServiceDefinitionModel, key: 'id' },
      },
      event: { type: DataTypes.STRING, allowNull: false },
      previousState: { type: DataTypes.TEXT, allowNull: true },
      newState: { type: DataTypes.TEXT, allowNull: true },
      triggeredBy: { type: DataTypes.STRING, allowNull: false },
      triggerSource: { type: DataTypes.STRING, allowNull: false },
      metadata: { type: DataTypes.TEXT, allowNull: true },
      processUid: { type: DataTypes.STRING, allowNull: true },
      createdAt: { type: DataTypes.DATE },
    },
    {
      sequelize,
      updatedAt: false,
      indexes: [{ fields: ['serviceId', 'createdAt'] }, { fields: ['serviceId', 'event'] }],
    },
  )

  ApiTokenModel.init(
    {
      id: { type: DataTypes.STRING, primaryKey: true },
      username: {
        type: DataTypes.STRING,
        allowNull: false,
        references: { model: UserModel, key: 'username' },
      },
      name: { type: DataTypes.STRING, allowNull: false },
      tokenHash: { type: DataTypes.STRING, allowNull: false },
      lastUsedAt: { type: DataTypes.DATE, allowNull: true },
      createdAt: { type: DataTypes.DATE },
    },
    { sequelize, updatedAt: false },
  )

  // --- Associations ---

  UserModel.hasOne(PasswordCredentialModel, { foreignKey: 'userName', onDelete: 'CASCADE' })
  PasswordCredentialModel.belongsTo(UserModel, { foreignKey: 'userName' })

  UserModel.hasMany(ApiTokenModel, { foreignKey: 'username', onDelete: 'CASCADE' })
  ApiTokenModel.belongsTo(UserModel, { foreignKey: 'username' })

  StackDefinitionModel.hasOne(StackConfigModel, { foreignKey: 'stackName', onDelete: 'CASCADE' })
  StackConfigModel.belongsTo(StackDefinitionModel, { foreignKey: 'stackName' })

  StackDefinitionModel.hasMany(ServiceDefinitionModel, { foreignKey: 'stackName', onDelete: 'CASCADE' })
  ServiceDefinitionModel.belongsTo(StackDefinitionModel, { foreignKey: 'stackName' })

  StackDefinitionModel.hasMany(GitHubRepositoryModel, { foreignKey: 'stackName', onDelete: 'CASCADE' })
  GitHubRepositoryModel.belongsTo(StackDefinitionModel, { foreignKey: 'stackName' })

  StackDefinitionModel.hasMany(PrerequisiteModel, { foreignKey: 'stackName', onDelete: 'CASCADE' })
  PrerequisiteModel.belongsTo(StackDefinitionModel, { foreignKey: 'stackName' })

  GitHubRepositoryModel.hasMany(ServiceDefinitionModel, { foreignKey: 'repositoryId', onDelete: 'SET NULL' })
  ServiceDefinitionModel.belongsTo(GitHubRepositoryModel, { foreignKey: 'repositoryId' })

  ServiceDefinitionModel.hasOne(ServiceConfigModel, { foreignKey: 'serviceId', onDelete: 'CASCADE' })
  ServiceConfigModel.belongsTo(ServiceDefinitionModel, { foreignKey: 'serviceId' })

  ServiceDefinitionModel.hasOne(ServiceStatusModel, { foreignKey: 'serviceId', onDelete: 'CASCADE' })
  ServiceStatusModel.belongsTo(ServiceDefinitionModel, { foreignKey: 'serviceId' })

  ServiceDefinitionModel.hasMany(ServiceStateHistoryModel, { foreignKey: 'serviceId', onDelete: 'CASCADE' })
  ServiceStateHistoryModel.belongsTo(ServiceDefinitionModel, { foreignKey: 'serviceId' })
}

export const setupDataStore = async (injector: Injector) => {
  ensureDataDir()
  const logger = getLogger(injector).withScope('DataStore')
  const dbOptions = getDbOptions()

  // Wrap initAllModels so it only runs once regardless of which store
  // is accessed first. Every useSequelize call receives this so the
  // lazy initialization is guaranteed to trigger on any first access.
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

  // --- Create DataSets with authorization ---

  getRepository(injector).createDataSet(User, 'username', { ...authorizedDataSet })
  getRepository(injector).createDataSet(PasswordCredential, 'userName', { ...authorizedDataSet })
  getRepository(injector).createDataSet(StackDefinition, 'name', { ...authorizedDataSet })
  getRepository(injector).createDataSet(StackConfig, 'stackName', { ...authorizedDataSet })
  getRepository(injector).createDataSet(GitHubRepository, 'id', { ...authorizedDataSet })
  getRepository(injector).createDataSet(Prerequisite, 'id', { ...authorizedDataSet })
  getRepository(injector).createDataSet(ServiceDefinition, 'id', { ...authorizedDataSet })
  getRepository(injector).createDataSet(ServiceConfig, 'serviceId', { ...authorizedDataSet })
  getRepository(injector).createDataSet(ServiceStatus, 'serviceId', { ...authorizedDataSet })
  getRepository(injector).createDataSet(ServiceStateHistory, 'id', { ...authorizedDataSet })
  getRepository(injector).createDataSet(ApiToken, 'id', { ...authorizedDataSet })

  await logger.information({ message: 'Data store initialized' })
}
