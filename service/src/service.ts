import { useStaticFiles } from '@furystack/rest-service'
import { injector } from './config.js'
import { attachShutdownHandler } from './shutdown-handler.js'
import { getPort } from './get-port.js'
import { setupInstallRestApi } from './app-models/install/setup-install-rest-api.js'
import { setupIdentityRestApi } from './app-models/identity/setup-identity-rest-api.js'
import { setupStacksRestApi } from './app-models/stacks/setup-stacks-rest-api.js'
import { setupServicesRestApi } from './app-models/services/setup-services-rest-api.js'
import { setupGitHubReposRestApi } from './app-models/github-repositories/setup-github-repos-rest-api.js'
import { setupDependenciesRestApi } from './app-models/dependencies/setup-dependencies-rest-api.js'
import { setupTokensRestApi } from './app-models/tokens/setup-tokens-rest-api.js'
import { WebsocketService } from './services/websocket-service.js'
import { setupMcp } from './mcp/setup-mcp.js'

const port = getPort()

const setupRestApis = async () => {
  await setupInstallRestApi(injector)
  await setupIdentityRestApi(injector)
  await setupStacksRestApi(injector)
  await setupServicesRestApi(injector)
  await setupGitHubReposRestApi(injector)
  await setupDependenciesRestApi(injector)
  await setupTokensRestApi(injector)

  const wsService = injector.getInstance(WebsocketService)
  await wsService.init(injector)

  await setupMcp(injector)
}

setupRestApis().catch((err) => {
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
