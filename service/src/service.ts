import { useSystemIdentityContext } from '@furystack/core'
import { getLogger } from '@furystack/logging'
import { usingAsync } from '@furystack/utils'
import { ServerManager, useStaticFiles } from '@furystack/rest-service'
import { injector } from './config.js'
import { attachShutdownHandler } from './shutdown-handler.js'
import { getPort } from './get-port.js'
import { setupDataStore } from './app-models/data-store/setup-data-store.js'
import { setupInstallRestApi } from './app-models/install/setup-install-rest-api.js'
import { setupIdentityRestApi } from './app-models/identity/setup-identity-rest-api.js'
import { setupStacksRestApi } from './app-models/stacks/setup-stacks-rest-api.js'
import { setupServicesRestApi } from './app-models/services/setup-services-rest-api.js'
import { setupGitHubReposRestApi } from './app-models/github-repositories/setup-github-repos-rest-api.js'
import { evaluatePrerequisites } from './app-models/prerequisites/evaluate-prerequisites.js'
import { setupPrerequisitesRestApi } from './app-models/prerequisites/setup-prerequisites-rest-api.js'
import { setupTokensRestApi } from './app-models/tokens/setup-tokens-rest-api.js'
import { setupSystemRestApi } from './app-models/system/setup-system-rest-api.js'
import { setupLogStore } from './app-models/logs/setup-log-store.js'
import { ProcessManager } from './services/process-manager.js'
import { WebsocketService } from './services/websocket-service.js'
import { setupEntitySync } from './setup-entity-sync.js'
import { setupMcp } from './mcp/setup-mcp.js'
import { useRequestLogger } from './middleware/request-logger.js'
import { encryptExistingSecrets } from './utils/encrypt-existing-secrets.js'

const port = getPort()

const setupRestApis = async () => {
  await setupDataStore(injector)
  await setupLogStore(injector)

  const processManager = injector.getInstance(ProcessManager)
  await processManager.reconcileStaleStates()

  await usingAsync(useSystemIdentityContext({ injector }), async (elevated) => {
    await encryptExistingSecrets(elevated)
  })

  await setupInstallRestApi(injector)
  await setupIdentityRestApi(injector)
  await setupStacksRestApi(injector)
  await setupServicesRestApi(injector)
  await setupGitHubReposRestApi(injector)
  await setupPrerequisitesRestApi(injector)
  await setupTokensRestApi(injector)
  await setupSystemRestApi(injector)

  const wsService = injector.getInstance(WebsocketService)
  await wsService.init(injector)

  setupEntitySync(injector)

  void evaluatePrerequisites(injector)

  setupMcp(injector)

  const logMiddleware = useRequestLogger(injector)
  const serverManager = injector.getInstance(ServerManager)
  for (const [, record] of serverManager.servers) {
    record.server.on('request', (req, res) => logMiddleware(req, res, () => {}))
  }
}

setupRestApis()
  .then(() =>
    useStaticFiles({
      injector,
      baseUrl: '/',
      path: '../frontend/dist',
      port,
      fallback: 'index.html',
    }),
  )
  .catch((err) => {
    getLogger(injector)
      .withScope('service')
      .fatal({ message: 'Failed to start service', data: { error: err } })
      .catch(() => console.error('Failed to start service (logger unavailable)', err))
      .finally(() => process.exit(1))
  })

void attachShutdownHandler(injector)
