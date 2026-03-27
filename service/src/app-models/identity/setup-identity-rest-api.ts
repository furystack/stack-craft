import type { Injector } from '@furystack/inject'
import {
  GetCurrentUser,
  IsAuthenticated,
  LoginAction,
  LogoutAction,
  useHttpAuthentication,
  useRestService,
  Validate,
} from '@furystack/rest-service'
import { User } from 'common'
import type { IdentityApi } from 'common'
import identityApiSchema from 'common/schemas/identity-api.json' with { type: 'json' }

import { getCorsOptions } from '../../get-cors-options.js'
import { getPort } from '../../get-port.js'
import { PasswordResetAction } from './actions/password-reset-action.js'

export const setupIdentityRestApi = async (injector: Injector) => {
  useHttpAuthentication(injector, { model: User })

  await useRestService<IdentityApi>({
    injector,
    root: 'api/identity',
    port: getPort(),
    name: 'Stack Craft Service',
    version: '1.0.0',
    description: 'StackCraft - Local microservice orchestration for developers',
    cors: getCorsOptions(),
    api: {
      GET: {
        '/currentUser': Validate({ schema: identityApiSchema, schemaName: 'GetCurrentUserAction' })(GetCurrentUser),
        '/isAuthenticated': Validate({ schema: identityApiSchema, schemaName: 'IsAuthenticatedAction' })(
          IsAuthenticated,
        ),
      },
      POST: {
        '/login': Validate({ schema: identityApiSchema, schemaName: 'LoginAction' })(LoginAction),
        '/logout': Validate({ schema: identityApiSchema, schemaName: 'LogoutAction' })(LogoutAction),
        '/password-reset': Validate({ schema: identityApiSchema, schemaName: 'PasswordResetAction' })(
          PasswordResetAction,
        ),
      },
    },
  })
}
