<!-- version-type: patch -->
# frontend

## ♻️ Refactoring

### Migrated to functional dependency injection (FuryStack v7)

Aligned the frontend with `@furystack/inject@^13` and the v7 majors of `core`, `cache`, `logging`, `rest-client-fetch`, `entity-sync-client`, `shades`, `shades-common-components`, and `shades-mfe`. No user-visible behavior change; the wire-up is now token-based.

**Highlights:**

- Converted all eight API clients (`identity-api-client`, `install-api-client`, `system-api-client`, `stacks-api-client`, `services-api-client`, `tokens-api-client`, `github-repos-api-client`, `prerequisites-api-client`) to the `class *Impl` + `defineService` token + `type` alias pattern, preserving the existing `injector.get(X).call(...)` and `private foo: X` consumer APIs.
- Same conversion for `SessionService`, `InstallService`, and `EnvironmentVariableService`. `SessionService` now auto-calls `init()` from its constructor so that `injector.get(SessionService)` at startup eagerly probes the auth state (matches the previous behavior tests rely on).
- Added `frontend/src/services/entity-sync.ts`: declares `AppEntitySyncService` via `defineEntitySyncService` and exports `useEntitySync` / `useCollectionSync` from `createSyncHooks(AppEntitySyncService)`. Replaces the root-exported hooks from `@furystack/entity-sync-client@^2`, which are gone.
- Simplified `components/layout/layout.tsx`: dropped the manual `new EntitySyncService(...)` + `useDisposable` registration in favour of `injector.get(AppEntitySyncService)`; disposal now happens through the injector lifecycle.
- Replaced every `injector.getInstance(X)` with `injector.get(X)` and every `injector.setExplicitInstance(value, Token)` with `injector.bind(Token, () => value)` (specs included).

## 🧪 Tests

- Spec setups (`session.spec`, `install-service.spec`, `environment-variable-service.spec`, `service-detail/utils.spec`) use `createInjector()` + `bind` for mock wiring instead of the removed `new Injector()` + `setExplicitInstance`.

## ⬆️ Dependencies

- Updated FuryStack stack to the v7 functional-DI majors:
  - `@furystack/cache` `^6.1.5` → `^7.0.0`
  - `@furystack/core` `^16.0.4` → `^17.0.0`
  - `@furystack/entity-sync` `^1.0.11` → `^2.0.0`
  - `@furystack/entity-sync-client` `^2.0.5` → `^3.0.0`
  - `@furystack/inject` `^12.0.36` → `^13.0.0`
  - `@furystack/logging` `^8.1.5` → `^9.0.0`
  - `@furystack/rest-client-fetch` `^8.1.8` → `^9.0.0`
  - `@furystack/shades` `^14.0.0` → `^15.0.0`
  - `@furystack/shades-common-components` `^16.0.0` → `^17.0.0`
  - `@furystack/shades-mfe` `^4.0.0` → `^5.0.0`
  - `@furystack/utils` `^8.2.5` → `^9.0.0`
