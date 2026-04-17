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
<!-- PLACEHOLDER: Describe your shiny new features (feat:) -->

## 🐛 Bug Fixes

### Fixed MCP Session Resource Leak on Expiry and Close

`McpSessionManager` now properly calls `[Symbol.asyncDispose]()` on the user-scoped injector when a session expires during the sweep cycle, when the transport closes, or when the manager itself is disposed. Previously, user-scoped injectors were silently abandoned, preventing cleanup of their associated resources.

### Fixed MCP Identity Scope During Session Creation

The `createMcpRequestHandler` function was passing the general elevated injector for Bearer token resolution. It now correctly uses a dedicated `authInjector` (system-level, read-only) for token lookup, keeping the authentication path isolated from the per-request user injector.

## 📚 Documentation
<!-- PLACEHOLDER: Describe documentation changes (docs:) -->

## ⚡ Performance
<!-- PLACEHOLDER: Describe performance improvements (perf:) -->

## ♻️ Refactoring

### ProcessManager Decomposed into Focused Service Classes

`ProcessManager` was a 210-line monolithic class responsible for starting, stopping, building, installing, and cloning services. It has been refactored into a thin facade that delegates to focused, independently-testable classes:

- `ServiceLifecycleManager` — start/stop/restart/kill
- `OneShotCommandRunner` — install/build commands
- `ServiceFileManager` — service file apply and merge
- `ServicePipelineOrchestrator` — pipeline sequencing and dependency ordering

`ProcessManager` is kept as a backward-compatible facade so existing REST actions and MCP tools require no changes.

## 🧪 Tests

- Added tests for `McpSessionManager` covering user-injector disposal on session close, sweep expiry, and full manager dispose
- Added tests for `system-tools` MCP tools
- Extended test coverage for `service-env-resolver`, `service-lifecycle-manager`, `service-pipeline-orchestrator`, and `service-status-manager`

## 📦 Build
<!-- PLACEHOLDER: Describe build system changes (build:) -->

## 👷 CI
<!-- PLACEHOLDER: Describe CI configuration changes (ci:) -->

## ⬆️ Dependencies
<!-- PLACEHOLDER: Describe dependency updates (deps:) -->

## 🔧 Chores

- Added verbose logging to `CheckEnvAvailabilityAction` to aid in request tracing during development
