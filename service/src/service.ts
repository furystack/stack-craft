import {
  DefaultSession,
  GetCurrentUser,
  IsAuthenticated,
  JsonResult,
  LoginAction,
  LogoutAction,
  Validate,
  useHttpAuthentication,
  useRestService,
  useStaticFiles,
} from '@furystack/rest-service'
import type { StackCraftApi } from 'common'
import { User } from 'common'
import StackCraftApiSchemas from 'common/schemas/stack-craft-api.json' with { type: 'json' }
import { injector } from './config.js'
import { attachShutdownHandler } from './shutdown-handler.js'

const port = parseInt(process.env.APP_SERVICE_PORT as string, 10) || 9090

useHttpAuthentication(injector, {
  getUserStore: (sm) => sm.getStoreFor(User, 'username'),
  getSessionStore: (sm) => sm.getStoreFor(DefaultSession, 'sessionId'),
})
useRestService<StackCraftApi>({
  injector,
  root: 'api',
  port,
  name: 'Stack Craft Service',
  version: '1.0.0',
  description: 'API for Stack Craft application containing simple authentication and example endpoints',
  cors: {
    credentials: true,
    origins: ['http://localhost:8080'],
    headers: ['cache', 'content-type'],
  },
  api: {
    GET: {
      '/currentUser': GetCurrentUser,
      '/isAuthenticated': IsAuthenticated,
      '/testQuery': Validate({ schema: StackCraftApiSchemas, schemaName: 'TestQueryEndpoint' })(async (options) =>
        JsonResult({ param1Value: options.getQuery().param1 }),
      ),
      '/testUrlParams/:urlParam': Validate({ schema: StackCraftApiSchemas, schemaName: 'TestUrlParamsEndpoint' })(
        async (options) => JsonResult({ urlParamValue: options.getUrlParams().urlParam }),
      ),
    },
    POST: {
      '/login': LoginAction,
      '/logout': LogoutAction,
      '/testPostBody': Validate({ schema: StackCraftApiSchemas, schemaName: 'TestPostBodyEndpoint' })(
        async (options) => {
          const body = await options.getBody()
          return JsonResult({ bodyValue: body.value })
        },
      ),
    },
  },
}).catch((err) => {
  console.error(err)
  process.exit(1)
})

useStaticFiles({
  injector,
  baseUrl: '/',
  path: '../frontend/dist',
  port,
  fallback: 'index.html',
}).catch((err) => {
  console.error(err)
  process.exit(1)
})

void attachShutdownHandler(injector)
