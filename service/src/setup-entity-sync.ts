import type { Injector } from '@furystack/inject'
import { useEntitySync } from '@furystack/entity-sync-service'
import { GitHubRepository, PublicApiToken, Service, Stack } from 'common'

export const setupEntitySync = (injector: Injector) => {
  useEntitySync(injector, {
    models: [
      { model: PublicApiToken, primaryKey: 'id' },
      { model: Stack, primaryKey: 'name' },
      { model: Service, primaryKey: 'id' },
      { model: GitHubRepository, primaryKey: 'id' },
    ],
  })
}
