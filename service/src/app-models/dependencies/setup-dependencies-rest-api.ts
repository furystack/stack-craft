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
import type { DependenciesApi } from 'common'
import { Dependency } from 'common'
import dependenciesApiSchema from 'common/schemas/dependencies-api.json' with { type: 'json' }

import { getCorsOptions } from '../../get-cors-options.js'
import { getPort } from '../../get-port.js'
import { CheckDependencyAction } from './actions/check-dependency-action.js'

export const setupDependenciesRestApi = async (injector: Injector) => {
  await useRestService<DependenciesApi>({
    injector,
    root: 'api/dependencies',
    port: getPort(),
    cors: getCorsOptions(),
    api: {
      GET: {
        '/dependencies': Validate({
          schema: dependenciesApiSchema,
          schemaName: 'GetCollectionEndpoint<Dependency>',
        })(createGetCollectionEndpoint({ model: Dependency, primaryKey: 'id' })),
        '/dependencies/:id': Validate({
          schema: dependenciesApiSchema,
          schemaName: 'GetEntityEndpoint<Dependency,"id">',
        })(createGetEntityEndpoint({ model: Dependency, primaryKey: 'id' })),
      },
      POST: {
        '/dependencies': Validate({
          schema: dependenciesApiSchema,
          schemaName: 'PostDependencyEndpoint',
        })(createPostEndpoint({ model: Dependency, primaryKey: 'id' })),
        '/dependencies/:id/check': Validate({
          schema: dependenciesApiSchema,
          schemaName: 'CheckDependencyEndpoint',
        })(CheckDependencyAction),
      },
      PATCH: {
        '/dependencies/:id': Validate({
          schema: dependenciesApiSchema,
          schemaName: 'PatchDependencyEndpoint',
        })(createPatchEndpoint({ model: Dependency, primaryKey: 'id' })),
      },
      DELETE: {
        '/dependencies/:id': createDeleteEndpoint({ model: Dependency, primaryKey: 'id' }),
      },
    },
  })
}
