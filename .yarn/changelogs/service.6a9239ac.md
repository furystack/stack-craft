<!-- version-type: minor -->
# service

## ✨ Features

### Process Manager

Added `ProcessManager` to orchestrate service lifecycle (clone, install, build, run, pull, setup, update) with child process management, `ServiceStateHistory` audit trail, and batched log forwarding to `LogStorageService`. Automatically reconciles stale states on startup.

### Git Integration

- `GitService` — wrapper for git operations: clone, fetch, pull, list branches, current branch, commits behind remote, and checkout
- `GitWatcher` — periodic remote fetch (default 5 min) per service with auto-fetch toggle; updates `ServiceGitStatus` and service status when remotes change
- `GitHeadWatcher` — monitors `.git/HEAD` for branch switches and updates branch/behind counts in `ServiceGitStatus`

### MCP Server

Exposed a Model Context Protocol server (Streamable HTTP on port 9091) with bearer token authentication and tools for:

- `stack-tools` — list, get, create, update, delete, export, import, and setup stacks
- `service-tools` — list, create, edit, delete services; start/stop/restart/install/build/pull/setup/update lifecycle; get logs and state history
- `prerequisite-tools` — list, check, create, update, and delete prerequisites
- `repository-tools` — list, get, create, update, delete, and validate repositories
- `env-variable-tools` — set/remove stack env variables and service env overrides
- `service-file-tools` — manage shared and local encrypted service files (list/read/add/update/remove/apply)
- `system-tools` — check environment variable availability

### Security

- `CryptoService` with AES-256-GCM encryption for sensitive environment variables and service files, keyed from `STACK_CRAFT_ENCRYPTION_KEY` or auto-generated `~/.stack-craft/encryption.key`
- `SecretDetector` with heuristic scanning for secrets in commands and file content
- Bearer API token authentication (`BearerTokenAuth`) with SHA-256 hashed storage; plaintext returned only at creation time
- Sensitive data masking on REST responses for environment variables and service files
- Startup migration (`encryptExistingSecrets`) to encrypt pre-existing plaintext secrets in the database

### Prerequisite Evaluation

Prerequisite check system supporting Node.js version, Yarn version, .NET SDK version, NuGet feed availability, environment variable presence, and custom script execution. Evaluates all prerequisites in the background after startup.

### Stack Import/Export

- `exportStackAction` — serializes a stack with its services, repositories, and prerequisites to JSON
- `importStackAction` — imports a stack from JSON with environment variable remapping, deduplication, and conflict resolution

### WebSocket Entity Sync

Real-time entity synchronization via WebSocket at `/api/ws` using `SyncSubscribeAction` / `SyncUnsubscribeAction` for live frontend updates.

### Additional REST Endpoints

- Password reset flow via `/api/identity/password-reset`
- `LogStorageService` for per-service log persistence, query, and pruning
- Repository URL validation via `git ls-remote`
- Environment variable availability check at `/api/system/check-env-availability`
- Service file application to disk via `/api/services/:id/apply-files`

## ♻️ Refactoring

### PostgreSQL Migration

Migrated from `@furystack/filesystem-store` (file-backed JSON) to PostgreSQL via `@furystack/sequelize-store` with Sequelize models and JSONB columns for flexible fields. In-memory stores retained for transient data (`ServiceGitStatus`, `PrerequisiteCheckResult`, sessions, log entries).

### REST API Reorganization

Restructured the REST API into domain-specific modules: identity, install, stacks, services, github-repositories, prerequisites, tokens, and system — each with dedicated setup, actions, and authorization.

### Seed Removal

Replaced the `seed.ts` script with an installer flow triggered from the frontend on first run.

## 🧪 Tests

- `ProcessManager` — lifecycle orchestration, state transitions, log batching, stale state reconciliation
- `GitService` — clone, fetch, pull, branches, current branch, commits behind, checkout
- `CryptoService` — encrypt/decrypt round-trip, key generation, tamper detection
- `env-encryption-helpers` — encrypt/mask/decrypt for stack and service payloads, `UNCHANGED_SENTINEL` handling
- `secret-detector` — heuristic pattern matching for secrets in commands and file content
- `apply-service-files` — merge and write service file definitions to disk
- `check-prerequisite-action` — all prerequisite types and edge cases
- `service-branches-action` / `service-checkout-action` — branch listing and checkout flows
- `service-lifecycle-action` — lifecycle action dispatching
- `import-export-actions` — stack export/import with remapping and deduplication
- `setup-tokens-rest-api` — token CRUD with hashed storage
- `bearer-token-auth` — token resolution and user loading
- `service-installer` — installation flow
- `config` / `get-cors-options` / `get-port` — configuration resolution

## ⬆️ Dependencies

- Added `sequelize`, `pg`, `pg-hstore`, `@furystack/sequelize-store` for PostgreSQL support
- Removed `@furystack/filesystem-store`
