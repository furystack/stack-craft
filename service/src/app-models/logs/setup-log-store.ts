import { addStore, InMemoryStore } from '@furystack/core'
import type { Injector } from '@furystack/inject'
import { getRepository } from '@furystack/repository'
import { ServiceLogEntry } from 'common'

import { authorizedDataSet } from '../../config.js'

export const setupLogStore = async (injector: Injector) => {
  let autoId = 0

  addStore(injector, new InMemoryStore({ model: ServiceLogEntry, primaryKey: 'id' }))
  getRepository(injector).createDataSet(ServiceLogEntry, 'id', {
    ...authorizedDataSet,
    modifyOnAdd: async ({ entity }) => ({ ...entity, id: ++autoId }),
  })
}
