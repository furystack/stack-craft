import type { Injector } from '@furystack/inject'
import { useRestService, Validate } from '@furystack/rest-service'
import type { SystemApi } from 'common'
import systemApiSchema from 'common/schemas/system-api.json' with { type: 'json' }

import { getCorsOptions } from '../../get-cors-options.js'
import { getPort } from '../../get-port.js'
import { CheckEnvAvailabilityAction } from './actions/check-env-availability-action.js'
import { HealthCheckAction } from './actions/health-check-action.js'

export const setupSystemRestApi = async (injector: Injector) => {
  await useRestService<SystemApi>({
    injector,
    root: 'api/system',
    port: getPort(),
    cors: getCorsOptions(),
    api: {
      GET: {
        '/system/health': Validate({ schema: systemApiSchema, schemaName: 'HealthCheckEndpoint' })(HealthCheckAction),
      },
      POST: {
        '/system/check-env-availability': Validate({
          schema: systemApiSchema,
          schemaName: 'CheckEnvAvailabilityEndpoint',
        })(CheckEnvAvailabilityAction),
      },
    },
  })
}
