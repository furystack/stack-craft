import type { Injector } from '@furystack/inject'
import { useEntitySync } from '@furystack/entity-sync-service'
import { PublicApiToken } from 'common'

export const setupEntitySync = (injector: Injector) => {
  useEntitySync(injector, {
    models: [{ model: PublicApiToken, primaryKey: 'id' }],
  })
}
