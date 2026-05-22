<!-- version-type: patch -->
# service

## ✨ Features

### Duplicate a Stack via Import with Fresh Entity IDs

`POST /stacks/import` now accepts an optional `regenerateIds: true` flag. When set, the import action replaces every incoming service / repository / prerequisite ID with a freshly generated UUID before the conflict check runs, and remaps cross-entity references (`services[].prerequisiteIds`, `services[].prerequisiteServiceIds`, and the `config.services` map keys) to the new IDs.

This unblocks the "export → import as duplicate under a new stack name + directory" flow on the same machine, where previously every entity ID collided with the source stack and the import was rejected with a 409 conflict.

## 🐛 Bug Fixes

- The conflict error returned by `POST /stacks/import` when entity IDs already exist now mentions the `regenerateIds` request flag (and the matching "Import as duplicate" UI toggle), instead of only listing the colliding IDs.

## ♻️ Refactoring

### Stack Export Strips `stackName` From Every Child Entity

`GET /stacks/:id/export` no longer emits `stackName` on each service, repository, or prerequisite in the response body. The value was always identical to the top-level `stack.name` and was pure repetition on the wire (one extra string per child entity). Imports already overwrote the incoming value with `stack.name`, so removing it from the wire shape has no behavioural effect, only a smaller payload.

See the `common` changelog for the breaking impact on previously saved export JSON files.

## 🧪 Tests

- Added `regenerate-import-ids.spec.ts` covering the ID remap helper: top-level entity ID regeneration, `prerequisiteIds` / `prerequisiteServiceIds` remap, `config.services` rekeying, input non-mutation, and orphan-reference pass-through.
- Extended `import-export-actions.spec.ts` with an end-to-end duplicate-import test (same payload imported twice under different stack names with `regenerateIds: true`) and an assertion that the conflict error message references the new flag.
- Updated existing import-action specs to construct payloads without `stackName` on child entities, matching the new contract.

## ⬆️ Dependencies

### `@furystack/entity-sync-service` 2 → 3 (major)

Bumped to pick up the bus-backed `SubscriptionManager`. `SubscriptionManager` now publishes / subscribes through the new `EntityChangeBus` (built on `@furystack/cross-node-bus`), `getModelRegistration()` returns `currentSeq: string` (without `changelogLength`), and `subscribeEntity(..., lastSeq?: string)` matches the new wire format. `stack-craft` is a single-node deployment, so the default in-process bus binding applies — no `CrossNodeBus` adapter is needed and no app wiring changes were required.

### Minor bumps

- `@furystack/core` `^17.0.0` → `^17.1.0`.
- `@furystack/rest-service` `^14.0.0` → `^14.1.0`.
- `@furystack/websocket-api` `^14.0.0` → `^14.1.0`.

### Patch bumps

- `@furystack/inject` `^13.0.0` → `^13.0.1`, `@furystack/logging` `^9.0.0` → `^9.0.1`, `@furystack/repository` `^11.0.0` → `^11.0.1`, `@furystack/security` `^8.0.0` → `^8.0.1`, `@furystack/sequelize-store` `^7.0.0` → `^7.0.1`.
- `pg` `^8.20.0` → `^8.21.0`.
- Dev `@types/node` `^25.6.0` → `^25.9.1`, `vitest` `^4.1.5` → `^4.1.7`.
