import { DataTypes } from 'sequelize'
import type { Sequelize } from 'sequelize'

import {
  ApiTokenModel,
  DefaultSessionModel,
  GitHubRepositoryModel,
  PasswordCredentialModel,
  PasswordResetTokenModel,
  PrerequisiteModel,
  ServiceConfigModel,
  ServiceDefinitionModel,
  ServiceStateHistoryModel,
  ServiceStatusModel,
  StackConfigModel,
  StackDefinitionModel,
  UserModel,
} from './models.js'

/**
 * Initializes ALL Sequelize models and their associations on the shared connection.
 * Called once via the first useSequelize's initModel callback.
 */
export async function initAllModels(sequelize: Sequelize): Promise<void> {
  UserModel.init(
    {
      username: { type: DataTypes.STRING, primaryKey: true },
      roles: {
        type: DataTypes.JSONB,
        defaultValue: [],
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
      environmentVariables: {
        type: DataTypes.JSONB,
        defaultValue: {},
      },
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
        type: DataTypes.JSONB,
        defaultValue: {},
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
        type: DataTypes.JSONB,
        defaultValue: [],
      },
      prerequisiteServiceIds: {
        type: DataTypes.JSONB,
        defaultValue: [],
      },
      installCommand: { type: DataTypes.STRING, allowNull: true },
      buildCommand: { type: DataTypes.STRING, allowNull: true },
      runCommand: { type: DataTypes.STRING, allowNull: false },
      files: {
        type: DataTypes.JSONB,
        defaultValue: [],
      },
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
      environmentVariableOverrides: {
        type: DataTypes.JSONB,
        defaultValue: {},
      },
      localFiles: {
        type: DataTypes.JSONB,
        defaultValue: [],
      },
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

  DefaultSessionModel.init(
    {
      sessionId: { type: DataTypes.STRING, primaryKey: true },
      username: {
        type: DataTypes.STRING,
        allowNull: false,
        references: { model: UserModel, key: 'username' },
      },
    },
    { sequelize, timestamps: false },
  )

  PasswordResetTokenModel.init(
    {
      token: { type: DataTypes.STRING, primaryKey: true },
      userName: {
        type: DataTypes.STRING,
        allowNull: false,
        references: { model: UserModel, key: 'username' },
      },
      createdAt: { type: DataTypes.DATE },
    },
    { sequelize, updatedAt: false },
  )

  // --- Associations ---

  UserModel.hasOne(PasswordCredentialModel, { foreignKey: 'userName', onDelete: 'CASCADE' })
  PasswordCredentialModel.belongsTo(UserModel, { foreignKey: 'userName' })

  UserModel.hasMany(ApiTokenModel, { foreignKey: 'username', onDelete: 'CASCADE' })
  ApiTokenModel.belongsTo(UserModel, { foreignKey: 'username' })

  UserModel.hasMany(DefaultSessionModel, { foreignKey: 'username', onDelete: 'CASCADE' })
  DefaultSessionModel.belongsTo(UserModel, { foreignKey: 'username' })

  UserModel.hasMany(PasswordResetTokenModel, { foreignKey: 'userName', onDelete: 'CASCADE' })
  PasswordResetTokenModel.belongsTo(UserModel, { foreignKey: 'userName' })

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
