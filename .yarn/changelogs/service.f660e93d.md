<!-- version-type: patch -->
# service

## ♻️ Refactoring

### Migrated to functional dependency injection (FuryStack v7)

Swapped the entire backend over to the token-based DI surface introduced by `@furystack/inject@^13`, `@furystack/core@^17`, and the v7 majors of `repository`, `security`, `sequelize-store`, `rest-service`, `entity-sync-service`, `websocket-api`, and `logging`. No external API of the deployed service changed; this is an internal restructure.

**Highlights:**

- Replaced every `@Injectable` / `@Injected` class with a `defineService` token wrapping a constructor-injection `*Impl` class. The exported name (e.g. `ProcessManager`, `GitService`, `ServiceStatusManager`) is now the token; consumers continue to call `injector.get(X)` and use the resolved instance the same way.
- Moved all stores and DataSets into the new `service/src/app-models/data-store/tokens.ts` module, declared with `defineSequelizeStore` / `defineStore` / `defineDataSet`. Authentication stores (`UserStore`, `SessionStore`, `PasswordCredentialStore`, `PasswordResetTokenStore`) are wired to the persistent sequelize-backed implementations through the new `bindAuthenticationStores(injector)` helper.
- Switched `WebsocketService.init` from `useWebsockets` to `useWebSocketApi` and started accepting `SyncSubscribeAction` / `SyncUnsubscribeAction` as plain action descriptors.
- Replaced the deleted `ServerManager` plumbing in `service.ts` and `shutdown-handler.ts` with the new `HttpServerPoolToken`; injector disposal now closes every pooled HTTP server.
- Replaced `useSequelize` in the patcher with a `defineSequelizeStore`-backed `PatchRunStoreToken` + `PatchRunDataSet`, eagerly resolved in `setupPatcher` to keep model initialization compatible with downstream patches.
- Reworked `health-check-action.ts` to resolve the database client through `SequelizeClientFactory` instead of the removed `injector.cachedSingletons` API.
- `setupIdentityRestApi` now relies on the default `UserDataSet` from `@furystack/rest-service` (backed by our `AppUserStore` through `bindAuthenticationStores`) and drops the old `{ model: User }` argument to `useHttpAuthentication`.
- `mcp/user-identity-context.ts`: `IdentityContext` is now an interface; `UserIdentityContext` implements it directly and is bound via `injector.bind` instead of `setExplicitInstance`.
- Repository call sites (`getRepository(injector).getDataSetFor(Model, 'pk')`) are preserved through a dedicated `service/src/utils/legacy-repository.ts` shim that resolves the matching DataSet token by model identity, keeping action and service code unchanged.
- Endpoint generators (`createGetCollectionEndpoint`, `createPostEndpoint`, etc.) now receive `DataSetToken`s in `setupGitHubReposRestApi` and `setupPrerequisitesRestApi`.

### Fixed a status-update race in `OneShotCommandRunner`

`runOneShot` previously fire-and-forgot the final `updateServiceStatus(installed/built)` call before resolving the install/build promise. Callers awaiting the runner could read the status while it was still `installing` / `building`. The exit / error handlers now await the status update before settling the returned promise.

## 🧪 Tests

- Added `service/src/test-shims.ts`: deprecation shim for the removed decorator-era APIs (`addStore`, `getStoreManager`, `injector.setExplicitInstance`, `injector.cachedSingletons`) so legacy spec setups continue to compile and run against the new functional DI surface.
- Updated `request-logger.spec.ts` to spy on a custom backend logger (via `createLogger`) instead of `LoggerCollection.verbose`, which is no longer reachable from `withScope(...)` in `@furystack/logging@^9`.
- Patcher tests (`check-for-orphaned-patch.spec.ts`, `run-patch.spec.ts`, `setup-patcher.spec.ts`) now use `useSystemIdentityContext` for elevation against authorized DataSets and bind the `PatchRunStoreToken` directly.
- `health-check-action.spec.ts` binds a stub `SequelizeClientFactory` and seeds `DATABASE_URL` per test instead of populating `injector.cachedSingletons`.
- `crypto-service`, `env-encryption-helpers`, and `filtered-console-logger` tests instantiate `*Impl` classes / resolve the logger token rather than the now-tokenized exports.

## 📦 Build

- `setup-patcher.ts` and `app-models/data-store/tokens.ts` build their `defineSequelizeStore` options through a lazy `Proxy` over `getDbOptions()` so importing the module no longer requires `DATABASE_URL` at load time (unblocks unit tests and tooling).

## ⬆️ Dependencies

- Updated FuryStack stack to the v7 functional-DI majors:
  - `@furystack/core` `^16.0.4` → `^17.0.0`
  - `@furystack/inject` `^12.0.36` → `^13.0.0`
  - `@furystack/logging` `^8.1.5` → `^9.0.0`
  - `@furystack/repository` `^10.1.11` → `^11.0.0`
  - `@furystack/rest-service` `^13.0.0` → `^14.0.0`
  - `@furystack/security` `^7.0.9` → `^8.0.0`
  - `@furystack/sequelize-store` `^6.0.49` → `^7.0.0`
  - `@furystack/websocket-api` `^13.2.8` → `^14.0.0`
  - `@furystack/entity-sync-service` `^1.0.13` → `^2.0.0`
- Bumped dev `@types/node` to `^25.6.0`, `typescript` to `^6.0.3`, and `vitest` to `^4.1.5`.
