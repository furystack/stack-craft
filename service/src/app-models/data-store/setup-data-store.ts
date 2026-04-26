import type { Injector } from '@furystack/inject'
import { getLogger } from '@furystack/logging'
import { usePasswordPolicy } from '@furystack/security'

import { bindAuthenticationStores } from './tokens.js'

export const setupDataStore = async (injector: Injector): Promise<void> => {
  const logger = getLogger(injector).withScope('DataStore')
  bindAuthenticationStores(injector)
  usePasswordPolicy(injector)
  await logger.information({ message: 'Data store initialized' })
}
