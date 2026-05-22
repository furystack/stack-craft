<!-- version-type: patch -->
# frontend

## ✨ Features

### "Import as Duplicate" Toggle on the Import Stack Page

Added an "Import as duplicate (generate new IDs)" checkbox below the main directory input on the Import Stack page. When enabled, the request is sent with `regenerateIds: true` and the server assigns fresh UUIDs to every imported service, repository, and prerequisite, remapping inter-entity references accordingly. Use this when importing a copy of a stack that already exists on this machine — without it, the import is rejected with a 409 conflict listing every colliding entity ID.

The checkbox is off by default to preserve the "cross-machine restore with stable IDs" flow.

## 🐛 Bug Fixes

### Adding an Env Variable in `Requirement` Mode No Longer Persists a Custom Value

Adding an environment variable through `EnvironmentVariablesManager` (stack edit page) or `ServiceEnvOverrides` (service detail page) with `Mode: Requirement (creates prerequisite)` previously wrote a `{ source: 'custom', customValue: '…' }` entry into the stack/service config in addition to creating the prerequisite. The variable then appeared with the `Custom` badge after refresh.

`Requirement` mode now ONLY creates the prerequisite. Use the prerequisite row that appears afterwards to pick `Inherit from system` or set a stack/service-level custom value. `Custom only (local)` mode behavior is unchanged.

## ♻️ Refactoring

- `EnvironmentVariablesManager` and `ServiceEnvOverrides` add forms: `Source` select and value input are now hidden when `Mode: Requirement` is selected — the prereq row drives value resolution after creation, so collecting the source/value alongside prereq creation was redundant and confusing.

## ⬆️ Dependencies

### `@furystack/cache` 7 → 8 (major)

Bumped to pick up the tag-based invalidation API (`getTags`, `obsoleteByTag`, `removeByTag`) that replaces the removed predicate-based `obsoleteRange` / `removeRange`. The frontend does not call the removed APIs directly, so no migration was required.

### `@furystack/entity-sync` 2 → 3 + `@furystack/entity-sync-client` 3 → 4 (major)

Bumped together. `SyncVersion.seq` / `ClientSyncMessage.lastSeq` / `SyncCacheEntry.lastSeq` are now opaque adapter-assigned strings instead of numeric counters — clients must not perform arithmetic or ordered comparison on them. `AppEntitySyncService` does not configure a `localStore`, so there is no persisted cache to invalidate on this upgrade. No code changes were needed in `frontend/src/services/entity-sync.ts`.

### Other bumps

- `@furystack/core` `^17.0.0` → `^17.1.0` (minor).
- `@furystack/inject` `^13.0.0` → `^13.0.1`, `@furystack/logging` `^9.0.0` → `^9.0.1`, `@furystack/rest-client-fetch` `^9.0.0` → `^9.0.1`, `@furystack/shades` `^15.0.0` → `^15.0.1`, `@furystack/shades-common-components` `^17.0.0` → `^17.0.1`, `@furystack/shades-mfe` `^5.0.0` → `^5.0.1`, `@furystack/utils` `^9.0.0` → `^9.0.1` (patch).
- Bumped dev `@types/node` `^25.6.0` → `^25.9.1`, `vite` `^8.0.10` → `^8.0.14`, `vitest` `^4.1.5` → `^4.1.7` (patch).
