<!-- version-type: minor -->
# stack-craft

## ✨ Features

### Operation concurrency limits exposed in `.env.example`

`.env.example` now documents three new tunables that cap concurrent CLI work in the service, so a long-running build never blocks a quick `git fetch` and the periodic `GitWatcher` cannot saturate the system on stacks with many services:

```env
# STACK_CRAFT_MAX_PARALLEL_GIT=10
# STACK_CRAFT_MAX_PARALLEL_INSTALLS=3
# STACK_CRAFT_MAX_PARALLEL_BUILDS=1
```

See the `service` changelog for the underlying `Semaphore`-backed pools and per-operation rationale (network-bound vs. shared-cache writes vs. CPU-bound).

## ♻️ Refactoring

- Every external CLI invocation in the service now goes through a single hardened spawn-based runner with cross-platform process-group kill — no more `promisify(execFile)` callers leaking grandchild processes past the nominal timeout. See the `service` changelog for the `runCli` helper, the `GitService` env hardening, and the migrated callers (validate-repo, MCP `validate_repository`, prerequisite checks).

## 🐛 Bug Fixes

- Fixed git update / pull operations sometimes appearing frozen for ~60 s before a bare `Command failed: …` error. Root cause and fix in the `service` changelog (nodejs/node#2098 — `execFile` timeout did not reach grandchild processes that held the inherited stdio pipes).
- Fixed `gh auth status` prerequisite check hanging indefinitely when GitHub CLI tried to launch an interactive browser auth flow. Details in the `service` changelog.
