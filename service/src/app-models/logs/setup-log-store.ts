import { defineStore, InMemoryStore } from '@furystack/core'
import type { Injector } from '@furystack/inject'
import { defineDataSet } from '@furystack/repository'
import { ServiceLogEntry } from 'common'

import { authorizedDataSet } from '../../auth-data-set.js'

export const ServiceLogEntryStore = defineStore({
  name: 'app/ServiceLogEntryStore',
  model: ServiceLogEntry,
  primaryKey: 'id',
  factory: () => new InMemoryStore({ model: ServiceLogEntry, primaryKey: 'id' }),
})

let autoId = 0

export const ServiceLogEntryDataSet = defineDataSet({
  name: 'app/ServiceLogEntryDataSet',
  store: ServiceLogEntryStore,
  settings: {
    ...authorizedDataSet,
    modifyOnAdd: async ({ entity }) => ({ ...entity, id: ++autoId }),
  },
})

export const setupLogStore = async (_injector: Injector): Promise<void> => {
  // Token-driven setup: stores and DataSets are declared at module scope.
  // Resolution is lazy on first `injector.get(...)`. Nothing to do here yet.
}
