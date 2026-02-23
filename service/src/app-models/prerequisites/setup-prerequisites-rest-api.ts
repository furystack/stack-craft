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
import type { PrerequisitesApi } from 'common'
import { Prerequisite } from 'common'
import prerequisitesApiSchema from 'common/schemas/prerequisites-api.json' with { type: 'json' }

import { getCorsOptions } from '../../get-cors-options.js'
import { getPort } from '../../get-port.js'
import { CheckPrerequisiteAction } from './actions/check-prerequisite-action.js'

export const setupPrerequisitesRestApi = async (injector: Injector) => {
  await useRestService<PrerequisitesApi>({
    injector,
    root: 'api/prerequisites',
    port: getPort(),
    cors: getCorsOptions(),
    api: {
      GET: {
        '/prerequisites': Validate({
          schema: prerequisitesApiSchema,
          schemaName: 'GetCollectionEndpoint<Prerequisite>',
        })(createGetCollectionEndpoint({ model: Prerequisite, primaryKey: 'id' })),
        '/prerequisites/:id': Validate({
          schema: prerequisitesApiSchema,
          schemaName: 'GetEntityEndpoint<Prerequisite,"id">',
        })(createGetEntityEndpoint({ model: Prerequisite, primaryKey: 'id' })),
      },
      POST: {
        '/prerequisites': Validate({
          schema: prerequisitesApiSchema,
          schemaName: 'PostPrerequisiteEndpoint',
        })(createPostEndpoint({ model: Prerequisite, primaryKey: 'id' })),
        '/prerequisites/:id/check': Validate({
          schema: prerequisitesApiSchema,
          schemaName: 'CheckPrerequisiteEndpoint',
        })(CheckPrerequisiteAction),
      },
      PATCH: {
        '/prerequisites/:id': Validate({
          schema: prerequisitesApiSchema,
          schemaName: 'PatchPrerequisiteEndpoint',
        })(createPatchEndpoint({ model: Prerequisite, primaryKey: 'id' })),
      },
      DELETE: {
        '/prerequisites/:id': createDeleteEndpoint({ model: Prerequisite, primaryKey: 'id' }),
      },
    },
  })
}
