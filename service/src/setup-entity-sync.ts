import type { Injector } from '@furystack/inject'
import { useEntitySync, type EntitySyncModelConfig } from '@furystack/entity-sync-service'
import type { DataSetToken } from '@furystack/repository'

import {
  GitHubRepositoryDataSet,
  PrerequisiteCheckResultDataSet,
  PrerequisiteDataSet,
  PublicApiTokenDataSet,
  ServiceConfigDataSet,
  ServiceDefinitionDataSet,
  ServiceDependencyLinkDataSet,
  ServiceGitStatusDataSet,
  ServicePrerequisiteLinkDataSet,
  ServiceStateHistoryDataSet,
  ServiceStatusDataSet,
  StackConfigDataSet,
  StackDefinitionDataSet,
} from './app-models/data-store/tokens.js'
import { ServiceLogEntryDataSet } from './app-models/logs/setup-log-store.js'

const sync = (
  token: DataSetToken<unknown, keyof unknown>,
  options?: Omit<EntitySyncModelConfig, 'dataSet'>,
): EntitySyncModelConfig => ({
  dataSet: token,
  ...options,
})

export const setupEntitySync = (injector: Injector) => {
  useEntitySync(injector, {
    models: [
      sync(PublicApiTokenDataSet as never),
      sync(StackDefinitionDataSet as never),
      sync(StackConfigDataSet as never),
      sync(ServiceDefinitionDataSet as never),
      sync(ServiceConfigDataSet as never),
      sync(ServiceStatusDataSet as never),
      sync(ServiceGitStatusDataSet as never),
      sync(GitHubRepositoryDataSet as never),
      sync(PrerequisiteDataSet as never),
      sync(ServicePrerequisiteLinkDataSet as never),
      sync(ServiceDependencyLinkDataSet as never),
      sync(PrerequisiteCheckResultDataSet as never),
      sync(ServiceLogEntryDataSet as never, { debounceMs: 250 }),
      sync(ServiceStateHistoryDataSet as never, { debounceMs: 250 }),
    ],
  })
}
