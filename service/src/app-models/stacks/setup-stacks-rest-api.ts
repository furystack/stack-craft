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
import type { StacksApi } from 'common'
import { Stack } from 'common'
import stacksApiSchema from 'common/schemas/stacks-api.json' with { type: 'json' }

import { getCorsOptions } from '../../get-cors-options.js'
import { getPort } from '../../get-port.js'
import { ExportStackAction } from './actions/export-stack-action.js'
import { ImportStackAction } from './actions/import-stack-action.js'

export const setupStacksRestApi = async (injector: Injector) => {
  await useRestService<StacksApi>({
    injector,
    root: 'api/stacks',
    port: getPort(),
    cors: getCorsOptions(),
    api: {
      GET: {
        '/stacks': Validate({ schema: stacksApiSchema, schemaName: 'GetCollectionEndpoint<Stack>' })(
          createGetCollectionEndpoint({ model: Stack, primaryKey: 'name' }),
        ),
        '/stacks/:id': Validate({ schema: stacksApiSchema, schemaName: 'GetEntityEndpoint<Stack,"name">' })(
          createGetEntityEndpoint({ model: Stack, primaryKey: 'name' }),
        ),
        '/stacks/:id/export': Validate({ schema: stacksApiSchema, schemaName: 'ExportStackEndpoint' })(
          ExportStackAction,
        ),
      },
      POST: {
        '/stacks': Validate({ schema: stacksApiSchema, schemaName: 'PostStackEndpoint' })(
          createPostEndpoint({ model: Stack, primaryKey: 'name' }),
        ),
        '/stacks/import': Validate({ schema: stacksApiSchema, schemaName: 'ImportStackEndpoint' })(
          ImportStackAction,
        ),
      },
      PATCH: {
        '/stacks/:id': Validate({
          schema: stacksApiSchema,
          schemaName: 'PatchStackEndpoint',
        })(createPatchEndpoint({ model: Stack, primaryKey: 'name' })),
      },
      DELETE: {
        '/stacks/:id': createDeleteEndpoint({ model: Stack, primaryKey: 'name' }),
      },
    },
  })
}
