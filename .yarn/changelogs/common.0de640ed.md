<!-- version-type: patch -->
# common

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

### Modular REST API Type Definitions

Replaced monolithic `boilerplate-api.ts` and `stack-craft-api.ts` with per-domain API modules for type-safe REST endpoints:

- `ServicesApi` — CRUD, lifecycle actions (start/stop/restart/install/build/pull/setup/update), log retrieval, log clearing, and state history
- `StacksApi` — CRUD, export (strips timestamps for portability), import with config overrides, and stack setup
- `PrerequisitesApi` — CRUD and dependency check actions
- `GithubRepositoriesApi` — CRUD and URL validation
- `TokensApi` — API token management endpoints
- `IdentityApi` — Login, logout, current user, and password reset
- `InstallApi` — First-run installation status and setup
- `SystemApi` — Environment variable availability checks

### Domain Models

Added typed models for all core entities: `StackDefinition`, `StackConfig`, `ServiceDefinition`, `ServiceConfig`, `ServiceStatus`, `ServiceStateHistory`, `ServiceLogEntry`, `GitHubRepository`, `Prerequisite`, `PrerequisiteCheckResult`, `ApiToken`, `PublicApiToken`, `EnvironmentVariableValue`, and `Views`.

### WebSocket Message Types

Added `WebsocketMessage` discriminated union for real-time events: `service-status-changed`, `git-branches-changed`, and `dependency-check-result`.

- `getServiceCwd()` — computes process working directory from stack config, service definition, and optional Git repository URL
- `getRepoNameFromUrl()` — extracts repository folder name from a Git URL

## ♻️ Refactoring

- Switched from a single schema file to per-API JSON schema generation via `create-schemas.ts`, producing separate schema files for each API surface

## 🧪 Tests

- Added unit tests for `getServiceCwd()` and `getRepoNameFromUrl()` in `service-path-utils.spec.ts`
