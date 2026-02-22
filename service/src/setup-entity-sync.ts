import type { Injector } from '@furystack/inject'
import { useEntitySync } from '@furystack/entity-sync-service'
import {
  GitHubRepository,
  PublicApiToken,
  ServiceConfig,
  ServiceDefinition,
  ServiceLogEntry,
  ServiceStateHistory,
  ServiceStatus,
  StackConfig,
  StackDefinition,
} from 'common'

export const setupEntitySync = (injector: Injector) => {
  useEntitySync(injector, {
    models: [
      { model: PublicApiToken, primaryKey: 'id' },
      { model: StackDefinition, primaryKey: 'name' },
      { model: StackConfig, primaryKey: 'stackName' },
      { model: ServiceDefinition, primaryKey: 'id' },
      { model: ServiceConfig, primaryKey: 'serviceId' },
      { model: ServiceStatus, primaryKey: 'serviceId' },
      { model: GitHubRepository, primaryKey: 'id' },
      { model: ServiceLogEntry, primaryKey: 'id', debounceMs: 250 },
      { model: ServiceStateHistory, primaryKey: 'id', debounceMs: 250 },
    ],
  })
}
