import { useSystemIdentityContext } from '@furystack/core'
import { getLogger } from '@furystack/logging'
import { usingAsync } from '@furystack/utils'
import { HttpServerPoolToken, useStaticFiles } from '@furystack/rest-service'
import { injector } from './config.js'
import { attachShutdownHandler } from './shutdown-handler.js'
import { getHost } from './get-host.js'
import { getPort } from './get-port.js'
import { setupDataStore } from './app-models/data-store/setup-data-store.js'
import { setupPatcher } from './patcher/setup-patcher.js'
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
import { ExternalGitChangeListener } from './services/external-git-change-listener.js'
import { ProcessManager } from './services/process-manager.js'
import { WebsocketService } from './services/websocket-service.js'
import { setupEntitySync } from './setup-entity-sync.js'
import { setupMcp } from './mcp/setup-mcp.js'
import { useRequestLogger } from './middleware/request-logger.js'
import { encryptExistingSecrets } from './utils/encrypt-existing-secrets.js'

const host = getHost()
const port = getPort()

const logStartupError = (scope: string, error: unknown): void => {
  getLogger(injector)
    .withScope(scope)
    .error({
      message: `Background startup task failed: ${error instanceof Error ? error.message : String(error)}`,
      data: { error },
    })
    .catch(() => console.error(`Background startup task failed (logger unavailable) [${scope}]`, error))
}

const setupRestApis = async () => {
  await setupDataStore(injector)
  await setupLogStore(injector)
  await setupPatcher(injector)

  injector.get(ExternalGitChangeListener).start()

  // Stale-state cleanup and secret re-encryption don't gate REST availability — run them
  // in the background so HTTP can start accepting requests sooner.
  const processManager = injector.get(ProcessManager)
  void processManager.reconcileStaleStates().catch((error) => logStartupError('StaleStateReconciler', error))

  void usingAsync(useSystemIdentityContext({ injector }), async (elevated) => {
    await encryptExistingSecrets(elevated)
  }).catch((error) => logStartupError('EncryptExistingSecrets', error))

  // Each module registers its own route group independently, so they can be set up concurrently.
  await Promise.all([
    setupInstallRestApi(injector),
    setupIdentityRestApi(injector),
    setupStacksRestApi(injector),
    setupServicesRestApi(injector),
    setupGitHubReposRestApi(injector),
    setupPrerequisitesRestApi(injector),
    setupTokensRestApi(injector),
    setupSystemRestApi(injector),
  ])

  const wsService = injector.get(WebsocketService)
  await wsService.init(injector)

  setupEntitySync(injector)

  void evaluatePrerequisites(injector)

  setupMcp(injector)

  const logMiddleware = useRequestLogger(injector)
  const pool = injector.get(HttpServerPoolToken)
  const record = await pool.acquire({ port, hostName: host })
  record.server.on('request', (req, res) => logMiddleware(req, res, () => {}))
}

setupRestApis()
  .then(() =>
    useStaticFiles({
      injector,
      baseUrl: '/',
      path: '../frontend/dist',
      hostName: host,
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
