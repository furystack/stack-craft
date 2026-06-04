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

Managed services launched by `ProcessRunner.spawnCommand()` now run inside a small Node supervisor (the `process-supervisor` module) instead of a bare shell. The supervisor watches the parent stack-craft process and, when the parent disappears without a graceful stop (`kill -9`, IDE force-stop, abrupt WSL exit, or a crash), tears down the entire child process tree.

- Parent death is detected via EOF on the supervisor's stdin pipe (the parent holds the write end and never writes to it). This fires the instant the parent dies and is immune to PID reuse, unlike polling `process.kill(parentPid, 0)`.
- On POSIX, the supervisor is the process-group leader and escalates SIGTERM → SIGKILL across the group, mirroring `ServiceLifecycleManager.shutdownAll()`.
- On Windows, it uses `taskkill /T` (then `/F`) to walk and kill the descendant tree, since process groups are unavailable.
- SIGTERM/SIGINT/SIGHUP from the parent are forwarded into the same kill cascade, so `killProcessGroup()` keeps working unchanged.
- The grace period before the SIGKILL escalation is configurable via the `WATCHDOG_GRACE_MS` environment variable (default: 5000 ms).

The supervisor is a first-class TypeScript module (type-checked and linted), resolved next to `process-runner` with the same extension — `.js` under `dist/` in production and the source `.ts` in dev/test (Node strips types natively).

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

- Updated `process-runner` spec coverage to assert that user commands are wrapped in the supervisor module (resolved path + stdin/pipe wiring) on both POSIX and Windows.
- Added `process-supervisor` unit specs covering the POSIX and Windows kill-tree branches in-process.
- Added a POSIX integration spec that spawns a real supervised process tree, drops the parent (closes stdin), and asserts the descendant is reaped.

## 📦 Build
<!-- PLACEHOLDER: Describe build system changes (build:) -->

## 👷 CI
<!-- PLACEHOLDER: Describe CI configuration changes (ci:) -->

## ⬆️ Dependencies
<!-- PLACEHOLDER: Describe dependency updates (deps:) -->

## 🔧 Chores
<!-- PLACEHOLDER: Describe other changes (chore:) -->
