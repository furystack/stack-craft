import type { Injector } from '@furystack/inject'
import '@furystack/repository'
import {
  createDeleteEndpoint,
  createGetCollectionEndpoint,
  createGetEntityEndpoint,
  createPatchEndpoint,
  createPostEndpoint,
  useRestService,
  Validate,
} from '@furystack/rest-service'
import type { ServicesApi } from 'common'
import { Service } from 'common'
import servicesApiSchema from 'common/schemas/services-api.json' with { type: 'json' }

import { getCorsOptions } from '../../get-cors-options.js'
import { getPort } from '../../get-port.js'
import { ClearServiceLogsAction } from './actions/clear-service-logs-action.js'
import { ServiceLifecycleAction } from './actions/service-lifecycle-action.js'
import { ServiceLogsAction } from './actions/service-logs-action.js'

export const setupServicesRestApi = async (injector: Injector) => {
  await useRestService<ServicesApi>({
    injector,
    root: 'api/services',
    port: getPort(),
    cors: getCorsOptions(),
    api: {
      GET: {
        '/services': Validate({ schema: servicesApiSchema, schemaName: 'GetCollectionEndpoint<Service>' })(
          createGetCollectionEndpoint({ model: Service, primaryKey: 'id' }),
        ),
        '/services/:id': Validate({ schema: servicesApiSchema, schemaName: 'GetEntityEndpoint<Service,"id">' })(
          createGetEntityEndpoint({ model: Service, primaryKey: 'id' }),
        ),
        '/services/:id/logs': Validate({ schema: servicesApiSchema, schemaName: 'ServiceLogsEndpoint' })(
          ServiceLogsAction,
        ),
      },
      POST: {
        '/services': Validate({ schema: servicesApiSchema, schemaName: 'PostServiceEndpoint' })(
          createPostEndpoint({ model: Service, primaryKey: 'id' }),
        ),
        '/services/:id/start': ServiceLifecycleAction('start'),
        '/services/:id/stop': ServiceLifecycleAction('stop'),
        '/services/:id/restart': ServiceLifecycleAction('restart'),
        '/services/:id/install': ServiceLifecycleAction('install'),
        '/services/:id/build': ServiceLifecycleAction('build'),
        '/services/:id/pull': ServiceLifecycleAction('pull'),
      },
      PATCH: {
        '/services/:id': Validate({
          schema: servicesApiSchema,
          schemaName: 'PatchServiceEndpoint',
        })(createPatchEndpoint({ model: Service, primaryKey: 'id' })),
      },
      DELETE: {
        '/services/:id': createDeleteEndpoint({ model: Service, primaryKey: 'id' }),
        '/services/:id/logs': ClearServiceLogsAction,
      },
    },
  })
}
