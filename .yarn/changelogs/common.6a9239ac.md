<!-- version-type: minor -->
# common

## ✨ Features

### Domain Model Layer

Added a full domain model layer for stack and service management, replacing the previous minimal `User`-only model surface:

- `StackDefinition` / `StackConfig` — stack metadata, main directory, and environment variable configuration
- `ServiceDefinition` / `ServiceConfig` — service commands, working directory, file definitions, and prerequisite associations
- `ServiceStatus` — typed status per pipeline stage (`CloneStatus`, `InstallStatus`, `BuildStatus`, `RunStatus`)
- `ServiceGitStatus` — branch name, commits behind remote, and auto-fetch flag
- `ServiceStateHistory` / `ServiceStateEvent` — audit trail of state transitions with trigger source tracking
- `ServiceLogEntry` — structured log entries per service process
- `GitHubRepository` — linked Git repository with URL and branch configuration
- `Prerequisite` / `PrerequisiteCheckResult` — typed prerequisites (Node.js, Yarn, .NET, NuGet, env var, custom script) with check status
- `ApiToken` / `PublicApiToken` — bearer token management for REST and MCP authentication
- `EnvironmentVariableValue` — environment variables with `isSecret` flag for encryption support
- `StackView` / `ServiceView` — entity views for filtered data projection

### Typed REST API Definitions

Replaced the single monolithic `StackCraftApi` with individual typed API interfaces, each with its own generated JSON schema:

- `IdentityApi` — authentication, current user, login/logout, password reset
- `InstallApi` — first-run service status and installation trigger
- `StacksApi` — stack CRUD, import/export, and setup orchestration
- `ServicesApi` — service CRUD, lifecycle actions (start/stop/restart/install/build/pull/setup/update), logs, history, branches, checkout, and file application
- `GitHubRepositoriesApi` — repository CRUD with URL validation
- `PrerequisitesApi` — prerequisite CRUD with on-demand check execution
- `TokensApi` — API token creation, listing, and deletion
- `SystemApi` — environment variable availability checks

### Service Path Utilities

- Added `getRepoNameFromUrl()` to extract repository names from Git URLs
- Added `getServiceCwd()` to resolve a service's working directory from stack config, service definition, and repository URL

## ♻️ Refactoring

- Removed `StackCraftApi` and `BoilerplateApi` single-API types in favor of per-domain API modules
- Removed test-only endpoints (`TestQueryEndpoint`, `TestUrlParamsEndpoint`, `TestPostBodyEndpoint`)
- Schema generation now emits one JSON file per API module instead of a single `stack-craft-api.json`

## 🧪 Tests

- Added unit tests for `getRepoNameFromUrl()` and `getServiceCwd()` path utilities

## ⬆️ Dependencies

- Added `@furystack/core` for shared entity types (`WithOptionalId`)
