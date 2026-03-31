<!-- version-type: patch -->
# service

## ✨ Features

- Added `GET /system/health` endpoint returning database connectivity and overall system health status
- Added HTTP request logging middleware that logs method, URL, status, and duration with log level based on status code (verbose for 2xx/3xx, warning for 4xx, error for 5xx)

## 🐛 Bug Fixes

- Fixed session state persistence to PostgreSQL
- Fixed branch checkout behavior when switching service branches

## ♻️ Refactoring

- Normalized data model with `ServiceDependencyLink` and `ServicePrerequisiteLink` join tables, replacing inline arrays on `ServiceDefinition`
- Split `ProcessManager` into single-responsibility services: `ProcessRunner` (process lifecycle), `ServiceStatusManager` (state transitions), `StaleStateReconciler` (orphan detection), `ServiceGraphResolver` (dependency ordering), `ServiceEnvResolver` (environment variable resolution), and `ProcessIOAttacher` (stdout/stderr handling)
- Extracted `GitOperationsService` for pull, install, and build operations
- Added `DomainError` hierarchy (`NotFoundError`, `ConflictError`, `ValidationError`) for structured error handling across REST actions
- Added `FilteredConsoleLogger` for configurable log level filtering
- Added `getServiceOrThrow()` utility for consistent service lookup with typed error handling
- Updated import/export actions to handle normalized service relations (dependency and prerequisite links)
- Refactored data-store setup into dedicated `init-models`, `models`, and `db-options` modules

## 🧪 Tests

- Added unit tests for new services: `process-runner`, `service-env-resolver`, `service-graph-resolver`, `service-status-manager`, `stale-state-reconciler`, `git-head-watcher`, `git-watcher`, `websocket-service`, `shutdown-handler`
- Added tests for new utilities: `domain-error`, `filtered-console-logger`, `get-service-or-throw`, `resolve-path`, `resolve-service-cwd`, `encrypt-existing-secrets`
- Added REST action tests: `health-check`, `service-logs`, `service-history`, `clear-service-logs`, `prerequisite-lifecycle`, `evaluate-prerequisites`, `password-reset`, `validate-repo`, `get-service-status`, `post-install`, `setup-log-store`, `db-options`
- Added MCP tests: `mcp-server`, `setup-mcp`, `mcp-helpers`, `system-tools`
- Expanded existing test coverage for `process-manager`, `service-checkout`, `service-lifecycle`, `service-branches`, `check-prerequisite`, `import-export-actions`, `check-env-availability`, `tokens-rest-api`, `log-storage-service`, `git-service`, and `get-cors-options`
