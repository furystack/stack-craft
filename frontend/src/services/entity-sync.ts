import { createSyncHooks, defineEntitySyncService } from '@furystack/entity-sync-client'

import { environmentOptions } from '../environment-options.js'

const buildSyncWsUrl = (): string => {
  const url = new URL(environmentOptions.serviceUrl)
  const protocol = url.protocol === 'https:' ? 'wss:' : 'ws:'
  return `${protocol}//${url.host}/api/ws`
}

export const AppEntitySyncService = defineEntitySyncService({
  wsUrl: buildSyncWsUrl(),
})

export const { useEntitySync, useCollectionSync } = createSyncHooks(AppEntitySyncService)
