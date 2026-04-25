import { createInjector } from '@furystack/inject'
import { useLogging } from '@furystack/logging'

import { FilteredConsoleLogger } from './utils/filtered-console-logger.js'

export const injector = createInjector()
useLogging(injector, FilteredConsoleLogger)

export { authorizedDataSet, authorizedOnly } from './auth-data-set.js'
