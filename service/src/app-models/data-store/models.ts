import type { DefaultSession } from '@furystack/rest-service'
import type { PasswordCredential, PasswordResetToken } from '@furystack/security'
import type {
  ApiToken,
  EnvironmentVariableValue,
  GitHubRepository,
  Prerequisite,
  PrerequisiteConfig,
  PrerequisiteType,
  ServiceConfig,
  ServiceDefinition,
  ServiceDependencyLink,
  ServiceFile,
  ServicePrerequisiteLink,
  ServiceStateHistory,
  ServiceStatus,
  StackConfig,
  StackDefinition,
  User,
} from 'common'
import { Model } from 'sequelize'

export class StackDefinitionModel extends Model<StackDefinition, StackDefinition> implements StackDefinition {
  declare name: string
  declare displayName: string
  declare description: string
  declare createdAt: string
  declare updatedAt: string
}

export class StackConfigModel extends Model<StackConfig, StackConfig> implements StackConfig {
  declare stackName: string
  declare mainDirectory: string
  declare environmentVariables: Record<string, EnvironmentVariableValue>
  declare createdAt: string
  declare updatedAt: string
}

export class ServiceDefinitionModel extends Model<ServiceDefinition, ServiceDefinition> implements ServiceDefinition {
  declare id: string
  declare stackName: string
  declare displayName: string
  declare description: string
  declare workingDirectory: string | undefined
  declare repositoryId: string | undefined
  declare installCommand: string | undefined
  declare buildCommand: string | undefined
  declare runCommand: string
  declare files: ServiceFile[]
  declare createdAt: string
  declare updatedAt: string
}

export class ServiceConfigModel extends Model<ServiceConfig, ServiceConfig> implements ServiceConfig {
  declare serviceId: string
  declare autoFetchEnabled: boolean
  declare autoFetchIntervalMinutes: number
  declare autoRestartOnFetch: boolean
  declare environmentVariableOverrides: Record<string, EnvironmentVariableValue>
  declare localFiles: ServiceFile[]
  declare createdAt: string
  declare updatedAt: string
}

export class ServiceStatusModel extends Model<ServiceStatus, ServiceStatus> implements ServiceStatus {
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

export class ServiceStateHistoryModel
  extends Model<ServiceStateHistory, ServiceStateHistory>
  implements ServiceStateHistory
{
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

export class GitHubRepositoryModel extends Model<GitHubRepository, GitHubRepository> implements GitHubRepository {
  declare id: string
  declare stackName: string
  declare url: string
  declare displayName: string
  declare description: string
  declare createdAt: string
  declare updatedAt: string
}

export class PrerequisiteModel extends Model<Prerequisite, Prerequisite> implements Prerequisite {
  declare id: string
  declare stackName: string
  declare name: string
  declare type: PrerequisiteType
  declare config: PrerequisiteConfig
  declare installationHelp: string
  declare createdAt: string
  declare updatedAt: string
}

export class UserModel extends Model<User, User> implements User {
  declare username: string
  declare roles: string[]
}

export class PasswordCredentialModel
  extends Model<PasswordCredential, PasswordCredential>
  implements PasswordCredential
{
  declare userName: string
  declare passwordHash: string
  declare salt: string
  declare creationDate: string
}

export class ApiTokenModel extends Model<ApiToken, ApiToken> implements ApiToken {
  declare id: string
  declare username: string
  declare name: string
  declare tokenHash: string
  declare lastUsedAt: string | undefined
  declare createdAt: string
}

export class DefaultSessionModel extends Model<DefaultSession, DefaultSession> implements DefaultSession {
  declare sessionId: string
  declare username: string
}

export class PasswordResetTokenModel
  extends Model<PasswordResetToken, PasswordResetToken>
  implements PasswordResetToken
{
  declare userName: string
  declare token: string
  declare createdAt: string
}

export class ServicePrerequisiteLinkModel
  extends Model<ServicePrerequisiteLink, ServicePrerequisiteLink>
  implements ServicePrerequisiteLink
{
  declare id: string
  declare serviceId: string
  declare prerequisiteId: string
}

export class ServiceDependencyLinkModel
  extends Model<ServiceDependencyLink, ServiceDependencyLink>
  implements ServiceDependencyLink
{
  declare id: string
  declare serviceId: string
  declare dependsOnServiceId: string
}
