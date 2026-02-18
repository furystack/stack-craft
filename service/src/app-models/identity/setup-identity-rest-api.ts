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
import type { IdentityApi } from 'common'
import { User } from 'common'
import identityApiSchema from 'common/schemas/identity-api.json' with { type: 'json' }
import { DefaultSession } from '@furystack/rest-service'

import { getCorsOptions } from '../../get-cors-options.js'
import { getPort } from '../../get-port.js'
import { PasswordResetAction } from './actions/password-reset-action.js'

export const setupIdentityRestApi = async (injector: Injector) => {
  useHttpAuthentication(injector, {
    getUserStore: (sm) => sm.getStoreFor(User, 'username'),
    getSessionStore: (sm) => sm.getStoreFor(DefaultSession, 'sessionId'),
  })

  await useRestService<IdentityApi>({
    injector,
    root: 'api',
    port: getPort(),
    name: 'Stack Craft Service',
    version: '1.0.0',
    description: 'StackCraft - Local microservice orchestration for developers',
    cors: getCorsOptions(),
    api: {
      GET: {
        '/currentUser': GetCurrentUser,
        '/isAuthenticated': IsAuthenticated,
      },
      POST: {
        '/login': LoginAction,
        '/logout': LogoutAction,
        '/password-reset': Validate({ schema: identityApiSchema, schemaName: 'PasswordResetAction' })(
          PasswordResetAction,
        ),
      },
    },
  })
}
