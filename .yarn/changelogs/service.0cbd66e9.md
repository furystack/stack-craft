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

## 🧪 Tests

- Added prerequisite-creation specs covering the duplicate-id `409` path and the check-result rollback path.
- Added stack-import specs covering duplicate `stack.name` and cross-stack duplicate `service.id` rejection, asserting the pre-existing records remain untouched.
