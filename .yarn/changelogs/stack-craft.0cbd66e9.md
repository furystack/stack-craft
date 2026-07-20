<!-- version-type: patch -->
# stack-craft

## 🐛 Bug Fixes

### Prevent silent overwrites when creating or importing entities with duplicate IDs

Creating a GitHub repository, prerequisite, service, or stack with an `id`/`name` that already exists now fails with a clear `409 Conflict` error instead of overwriting the existing record or returning an opaque store error. Importing a stack performs the same collision check up-front across the stack name and all nested service, repository, and prerequisite ids, so a conflicting import is rejected before any data is mutated.

Partially-created entities are also rolled back when a later step in the create flow fails (e.g. service definition + config + status + links), so failed creates no longer leave orphan rows behind.

See the `service` changelog for the affected endpoints and response details.
