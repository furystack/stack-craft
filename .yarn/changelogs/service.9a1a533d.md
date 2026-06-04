<!-- version-type: minor -->
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

## 🗑️ Deprecated
<!-- PLACEHOLDER: Describe deprecated features. Double-check if they are annotated with a `@deprecated` jsdoc tag. -->

## ✨ Features

### Supervised service processes survive abrupt parent termination

Managed services launched by `ProcessRunner.spawnCommand()` now run inside a small Node supervisor (started via `node -e`) instead of a bare shell. The supervisor polls the parent stack-craft process and, when the parent disappears without a graceful stop (`kill -9`, IDE force-stop, abrupt WSL exit, or a crash), tears down the entire child process tree.

- On POSIX, the supervisor is the process-group leader and escalates SIGTERM → SIGKILL across the group, mirroring `ServiceLifecycleManager.shutdownAll()`.
- On Windows, it uses `taskkill /T` (then `/F`) to walk and kill the descendant tree, since process groups are unavailable.
- SIGTERM/SIGINT/SIGHUP from the parent are forwarded into the same kill cascade, so `killProcessGroup()` keeps working unchanged.
- Grace and poll intervals are configurable via the `WATCHDOG_GRACE_MS` and `WATCHDOG_POLL_MS` environment variables (defaults: 5000 ms and 1000 ms).

This prevents orphaned service processes from lingering when stack-craft itself goes away unexpectedly.

## 🐛 Bug Fixes
<!-- PLACEHOLDER: Describe the nasty little bugs that has been eradicated (fix:) -->

## 📚 Documentation
<!-- PLACEHOLDER: Describe documentation changes (docs:) -->

## ⚡ Performance
<!-- PLACEHOLDER: Describe performance improvements (perf:) -->

## ♻️ Refactoring
<!-- PLACEHOLDER: Describe code refactoring (refactor:) -->

## 🧪 Tests

- Updated `process-runner` spec coverage to assert that user commands are wrapped in the Node supervisor (parent pid + shell invocation) on both POSIX and Windows.

## 📦 Build
<!-- PLACEHOLDER: Describe build system changes (build:) -->

## 👷 CI
<!-- PLACEHOLDER: Describe CI configuration changes (ci:) -->

## ⬆️ Dependencies
<!-- PLACEHOLDER: Describe dependency updates (deps:) -->

## 🔧 Chores
<!-- PLACEHOLDER: Describe other changes (chore:) -->
