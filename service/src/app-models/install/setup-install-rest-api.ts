import type { Injector } from '@furystack/inject'
import { useRestService, Validate } from '@furystack/rest-service'
import type { InstallApi } from 'common'
import installApiSchema from 'common/schemas/install-api.json' with { type: 'json' }

import { getCorsOptions } from '../../get-cors-options.js'
import { getHost } from '../../get-host.js'
import { getPort } from '../../get-port.js'
import { GetServiceStatus } from './actions/get-service-status.js'
import { PostInstallAction } from './actions/post-install-action.js'

export const setupInstallRestApi = async (injector: Injector) => {
  await useRestService<InstallApi>({
    injector,
    root: 'api/install',
    hostName: getHost(),
    port: getPort(),
    cors: getCorsOptions(),
    api: {
      GET: {
        '/serviceStatus': Validate({ schema: installApiSchema, schemaName: 'GetServiceStatusAction' })(
          GetServiceStatus,
        ),
      },
      POST: {
        '/install': Validate({ schema: installApiSchema, schemaName: 'InstallAction' })(PostInstallAction),
      },
    },
  })
}
