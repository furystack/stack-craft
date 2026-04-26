import type { Injector } from '@furystack/inject'
import '@furystack/repository'
import {
  createGetCollectionEndpoint,
  createGetEntityEndpoint,
  createPatchEndpoint,
  useRestService,
  Validate,
} from '@furystack/rest-service'
import type { PrerequisitesApi } from 'common'
import prerequisitesApiSchema from 'common/schemas/prerequisites-api.json' with { type: 'json' }

import { PrerequisiteDataSet } from '../data-store/tokens.js'
import { getCorsOptions } from '../../get-cors-options.js'
import { getHost } from '../../get-host.js'
import { getPort } from '../../get-port.js'
import { CheckPrerequisiteAction } from './actions/check-prerequisite-action.js'
import { CreatePrerequisiteAction, DeletePrerequisiteAction } from './actions/prerequisite-lifecycle-actions.js'

export const setupPrerequisitesRestApi = async (injector: Injector) => {
  await useRestService<PrerequisitesApi>({
    injector,
    root: 'api/prerequisites',
    hostName: getHost(),
    port: getPort(),
    cors: getCorsOptions(),
    api: {
      GET: {
        '/prerequisites': Validate({
          schema: prerequisitesApiSchema,
          schemaName: 'GetCollectionEndpoint<Prerequisite>',
        })(createGetCollectionEndpoint(PrerequisiteDataSet)),
        '/prerequisites/:id': Validate({
          schema: prerequisitesApiSchema,
          schemaName: 'GetEntityEndpoint<Prerequisite,"id">',
        })(createGetEntityEndpoint(PrerequisiteDataSet)),
      },
      POST: {
        '/prerequisites': Validate({
          schema: prerequisitesApiSchema,
          schemaName: 'PostPrerequisiteEndpoint',
        })(CreatePrerequisiteAction),
        '/prerequisites/:id/check': Validate({
          schema: prerequisitesApiSchema,
          schemaName: 'CheckPrerequisiteEndpoint',
        })(CheckPrerequisiteAction),
      },
      PATCH: {
        '/prerequisites/:id': Validate({
          schema: prerequisitesApiSchema,
          schemaName: 'PatchPrerequisiteEndpoint',
        })(createPatchEndpoint(PrerequisiteDataSet)),
      },
      DELETE: {
        '/prerequisites/:id': Validate({
          schema: prerequisitesApiSchema,
          schemaName: 'DeleteEndpoint<Prerequisite,"id">',
        })(DeletePrerequisiteAction),
      },
    },
  })
}
