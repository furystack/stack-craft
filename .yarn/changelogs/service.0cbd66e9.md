<!-- version-type: patch -->
# service

## 🐛 Bug Fixes

### Reject duplicate IDs with `409 Conflict` on create endpoints

Creating an entity with a client-supplied `id`/`name` that already exists now fails fast with a `409` response and a descriptive message instead of surfacing a generic store-level error (or, worse, silently overwriting state during a stack import). Affected endpoints:

- `POST /github-repositories` — rejects when `body.id` matches an existing GitHub repository.
- `POST /prerequisites` — rejects when `body.id` matches an existing prerequisite.
- `POST /services` — rejects when `body.id` matches an existing service definition.
- `POST /stacks` — rejects when `body.name` matches an existing stack.

### Pre-flight conflict check on stack import

`POST /stacks/import` now collects all id collisions (`stack.name`, `services[].id`, `repositories[].id`, `prerequisites[].id`) before touching any store, and returns a single `409` listing every conflicting id. Previously, the importer could partially apply changes and then enter the rollback path, which would delete the pre-existing records that shared the colliding ids.

### Atomic rollback on partial-create failures

Multi-step create flows now undo the records they have already inserted when a later step fails, so a failed create no longer leaves orphaned rows in the data store:

- `POST /prerequisites` — removes the prerequisite if seeding the initial `PrerequisiteCheckResult` throws.
- `POST /services` — removes the partially-inserted `ServiceDefinition`, `ServiceConfig`, `ServiceStatus`, and link rows if any later insert throws.
- `POST /stacks` — removes the `StackDefinition` if inserting the `StackConfig` throws.

Errors that are not already a `RequestError` are wrapped into a `500` with the original message preserved.

## 🔧 Refactor

The duplicate-id check and the multi-step create + rollback logic for `POST /services`, `POST /stacks`, and `POST /github-repositories` were moved out of the inline `setup-*-rest-api.ts` handlers into named, testable `RequestAction` modules — matching the existing `ImportStackAction` / `CreatePrerequisiteAction` shape:

- `service/src/app-models/services/actions/create-service-action.ts` — exports `CreateServiceAction`, with `assertNoServiceIdCollision`, `buildServiceArtifacts`, and `createServiceWithRollback` as module-local helpers.
- `service/src/app-models/stacks/actions/create-stack-action.ts` — exports `CreateStackAction` with an `assertNoStackNameCollision` helper.
- `service/src/app-models/github-repositories/actions/create-github-repo-action.ts` — exports `CreateGitHubRepoAction`.

The three `setup-*-rest-api.ts` files now wire the action through `Validate(...)` with no inline logic, which removes the High/Medium complexity findings introduced by the original fix on the services and stacks endpoints. No behavioral change.

## 🧪 Tests

- Added prerequisite-creation specs covering the duplicate-id `409` path and the check-result rollback path.
- Added stack-import specs covering duplicate `stack.name` and cross-stack duplicate `service.id` rejection, asserting the pre-existing records remain untouched.
- Added `create-github-repo-action.spec.ts` covering happy-path persistence (`201`) and duplicate-id `409`.
- Added `create-stack-action.spec.ts` covering duplicate-name `409` and the `StackDefinition` rollback when `StackConfig.add` throws.
- Added `create-service-action.spec.ts` covering duplicate-id `409`, full rollback when the `ServiceStatus` insert throws, and link-row rollback when a later `ServiceDependencyLink` insert throws.
- Extended `import-export-actions.spec.ts` with duplicate-`repository.id` and combined service+repo+prerequisite collision tests, asserting `assertNoImportConflicts` aggregates every conflicting id into a single `409` message.
