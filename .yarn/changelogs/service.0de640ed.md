<!-- version-type: patch -->
# service

<!--
FORMATTING GUIDE:

### Detailed Entry (appears first when merging)

Use h3 (###) and below for detailed entries with paragraphs, code examples, and lists.

### Simple List Items

- Simple changes can be added as list items
- They are collected together at the bottom of each section

TIP: When multiple changelog drafts are merged, heading-based entries
appear before simple list items within each section.
-->

## ✨ Features

### REST API Endpoints

Added per-domain REST API modules with full CRUD and custom actions:

- `ServicesApi` — service lifecycle (start/stop/restart/install/build/pull/setup/update), log retrieval and clearing, state history, and file application
- `StacksApi` — stack CRUD, export to portable JSON, import with config overrides, and stack setup orchestration
- `PrerequisitesApi` — prerequisite CRUD and dependency check execution (supports command, package manager, and environment variable checks)
- `GithubRepositoriesApi` — repository CRUD with Git URL validation
- `TokensApi` — API token creation with SHA-256 hashing, listing (public view only), and revocation
- `IdentityApi` — session-based authentication and password reset
- `InstallApi` — first-run service status check and initial admin setup
- `SystemApi` — environment variable availability checks

### Process Manager

Added `ProcessManager` service that orchestrates child process lifecycle for stack services: clone repositories, install dependencies, build projects, and run services. Captures stdout/stderr streams, persists log entries via `LogStorageService`, and broadcasts status changes over WebSocket.

### MCP Server

Added Model Context Protocol server on a dedicated HTTP port (default 9091) with tools for managing stacks, services, repositories, prerequisites, environment variables, service files, and system status — enabling AI assistant integration.

### Git Integration

- Added `GitService` for repository operations: clone, fetch, pull (with update detection), branch listing, current branch, and checkout
- Added `GitWatcher` for periodic polling of branch changes with WebSocket notifications

### Log Storage

Added `LogStorageService` with durable log entry persistence, per-service pruning to cap storage, text search filtering, and batch clearing.

### Bearer Token Authentication

Added `bearer-token-auth` middleware that resolves `Authorization: Bearer <token>` headers by SHA-256 hashing the token, looking up the matching `ApiToken`, and returning the associated user.

### Real-Time Communication

- Added `WebsocketService` for broadcasting typed messages to connected clients
- Added entity sync setup with debounced updates for `ServiceLogEntry` and `ServiceStateHistory`

### Configuration

- Added configurable CORS origins via `CORS_ORIGINS` environment variable (comma-separated list)
- Added `MCP_PORT` environment variable for MCP server port configuration
- Extended `Config` with stack-craft-specific settings (`mainDirectory`, data storage path)

### Data Store

- Added `setup-data-store` with in-memory stores, filesystem persistence, and authorization rules for all entities
- Added `setup-log-store` for service log entries with auto-incrementing IDs

### Utilities

- Added `resolve-service-cwd` for computing service working directories from stack/service/repo config
- Added `apply-service-files` for writing required files into service directories
- Added `resolve-path` for safe path resolution within allowed directories

## 🐛 Bug Fixes

- Fixed detached child processes not being properly terminated on service stop
- Fixed missing entity sync causing stale data in frontend views
- Fixed service installer not correctly reporting installation completion status

## ♻️ Refactoring

- Restructured REST API handlers from a single file into per-domain modules under `app-models/`
- Extracted service lifecycle logic into dedicated action handlers with proper authorization

## 🧪 Tests

- Added unit tests for `ProcessManager` covering spawn, kill, and concurrent process scenarios
- Added unit tests for `check-prerequisite-action` covering command, package manager, and env variable checks
- Added unit tests for `service-lifecycle-action` covering start, stop, and restart flows
- Added unit tests for `setup-tokens-rest-api` covering token creation, listing, and revocation
- Added unit tests for `import-export-actions` covering stack export and import with conflict handling
- Added unit tests for `check-env-availability-action` covering env variable presence detection
- Added unit tests for `bearer-token-auth` covering valid/invalid/missing token scenarios
- Added unit tests for `LogStorageService` covering entry storage, retrieval, pruning, and clearing
- Added unit tests for `GitService` covering clone, pull, branch listing, and checkout
- Added unit tests for `ServiceInstaller` covering installation flow
- Added unit tests for `get-cors-options` and `get-port` configuration helpers
- Added unit tests for `Config` service
