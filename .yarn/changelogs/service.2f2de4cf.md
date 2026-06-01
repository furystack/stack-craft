<!-- version-type: minor -->
# service

## ✨ Features

### Per-operation concurrency pools (`GitOperationLimit`, `InstallOperationLimit`, `BuildOperationLimit`)

Three new injector-resolved `Semaphore` singletons (from `@furystack/utils`) cap the number of CLI operations the service runs in parallel, broken down by cost profile so a long build never blocks a quick `git fetch`:

- **`GitOperationLimit`** (default `10`) — caps every `GitService` call (`clone`, `fetch`, `pull`, `lsRemote`, branch reads, status). Network-bound; the cap mainly stops the periodic `GitWatcher` from saturating the system on stacks with many services.
- **`InstallOperationLimit`** (default `3`) — caps `OneShotCommandRunner.installService`. Installs are network + disk heavy and frequently write to shared package caches (yarn / pnpm / npm / nuget) where concurrent writers can race.
- **`BuildOperationLimit`** (default `1`) — caps `OneShotCommandRunner.buildService`. Each build already saturates multiple cores (tsc -b, webpack, dotnet build, …); running more than a handful in parallel typically thrashes the machine.

All three are tunable via env vars (`STACK_CRAFT_MAX_PARALLEL_GIT`, `STACK_CRAFT_MAX_PARALLEL_INSTALLS`, `STACK_CRAFT_MAX_PARALLEL_BUILDS`); non-numeric or non-positive values fall back to the default. The semaphore signal is threaded through `runCli`, so disposing the injector aborts in-flight ops with a process-group kill instead of orphaning child processes. Per-service guards (`pendingOperations` / `processes` map) stack on top — the conflict check still rejects a duplicate trigger immediately rather than queueing it.

The pre-existing `setupServices` batch flow (which previously fanned out 22 concurrent setups when no service dependencies were declared) now serializes naturally through these pools. Per-service status flips to `installing` / `building` only after the slot is acquired, so the audit log timestamps reflect actual work, not queue time.

### `GitService.lsRemote(url)` — consolidated repository accessibility probe

New method on `GitService` that runs `git ls-remote --exit-code <url>` with the standard `GitService` env hardening (`GIT_TERMINAL_PROMPT=0`, `BatchMode=yes` ssh) and shares the `GitOperationLimit` pool. Replaces the two ad-hoc `execFile('git', ['ls-remote', '--exit-code', url], { timeout: 15000 })` callers — `validate-repo-action` and the MCP `validate_repository` tool — which previously had no env hardening and no process-group kill. Default timeout is 30 s.

## 🐛 Bug Fixes

### Git update / pull no longer feels frozen

`GitService` previously used `promisify(execFile)` with a `timeout` option for every git call. When the timeout fired, Node sent SIGTERM only to the parent git process, leaving grandchildren (credential helpers, ssh, `git-remote-https`, GUI askpass dialogs) holding the inherited stdio pipes. Because `execFile`'s callback fires on stream `close` (not on parent exit), the promise could stay pending well past the nominal timeout — visible in audit logs as a 60-second silence followed by a bare `Command failed: git fetch --all --prune\n` with no stderr, which is the documented Node gotcha (nodejs/node#2098).

Every git invocation now goes through a new spawn-based `runCli` helper that:

- Uses `detached: true` on POSIX so the child becomes a process-group leader, then kills the whole group with `process.kill(-pid, signal)` on timeout. On Windows it walks the child tree with `taskkill /T` (escalating to `/F` only on `SIGKILL`).
- Escalates SIGTERM → SIGKILL after a 2 s grace.
- Captures stderr and surfaces it in the rejection message, replacing the previous opaque `Command failed: <cmd>\n`.
- Forces non-interactive mode for git: `GIT_TERMINAL_PROMPT=0`, removes inherited `GIT_ASKPASS` / `SSH_ASKPASS`, sets `SSH_ASKPASS_REQUIRE=never`, and pins `GIT_SSH_COMMAND='ssh -o BatchMode=yes -o ConnectTimeout=15 -o StrictHostKeyChecking=accept-new'`. Missing or expired credentials now fail fast instead of waiting for a prompt nobody can answer from a backend service.

Network-side timeouts also relaxed where appropriate: `fetch` and `pull` go from 60 s to 90 s; `clone` stays at 5 min; cheap local reads stay at 5–10 s.

### `gh auth status` prerequisite check is now non-interactive

The `github-cli` prerequisite check ran `gh auth status` through `execFile` without any env hardening, so a stale GitHub CLI token could trigger a browser-based re-auth flow that blocked indefinitely. `GH_PROMPT_DISABLED=1` and `GH_NO_UPDATE_NOTIFIER=1` are now passed on the call, and the same process-group kill machinery applies on timeout.

## ♻️ Refactoring

### `runCli` helper replaces `promisify(execFile)` across the service layer

New helper in `service/src/utils/run-cli.ts` is the canonical way to invoke any CLI from the service. Public API:

```typescript
import { runCli } from '../utils/run-cli.js'

const { stdout, stderr } = await runCli('node', ['--version'], {
  cwd: '/path',
  timeoutMs: 30_000,
  env: { GH_PROMPT_DISABLED: '1' }, // overrides; set a key to `undefined` to strip an inherited var
  signal: abortController.signal, // optional; aborts via process-group kill, same machinery as timeout
})
```

Migrated callers — every external CLI invocation in the service now goes through `runCli` (or through `GitService`, which itself uses `runCli`):

- `validate-repo-action` and MCP `validate_repository` tool — now use `GitService.lsRemote` (which routes through `runCli` with git env hardening + `GitOperationLimit`).
- `check-prerequisite-action` — every check (`node --version`, `yarn --version` / `cmd.exe /c yarn --version` shim, `dotnet --list-sdks` / `--list-runtimes` / `nuget list source`, `git --version`, `gh auth status`, custom-script via `cmd.exe` / `/bin/sh`) now uses `runCli`.

The two file-level results: dropped `import { execFile } from 'child_process'` + `import { promisify } from 'util'` from three actions and the MCP repository-tools registrar; consolidated process-group kill, env hardening, and stderr-rich error reporting into one tested helper.

## 🧪 Tests

- Added `service/src/utils/run-cli.spec.ts` — env passthrough, env strip-on-`undefined`, `stdio` / `windowsHide` / `cwd`, POSIX `detached: true`, success path, non-zero exit reports stderr + cwd, child `error` event, two-stage timeout kill (POSIX + Windows branches), no-kill-before-deadline.
- Added `service/src/services/git-service-runner.spec.ts` — git env hardening (`GIT_TERMINAL_PROMPT=0`, askpass strip, `BatchMode=yes` ssh), spawn options, timeout-and-kill, non-zero exit error context, and `GitOperationLimit` queueing (3 concurrent fetches under `Semaphore(2)` — first two spawn, third waits, third spawns after first drains).
- Added `service/src/services/operation-limits.spec.ts` — defaults (10 / 3 / 1), valid integer overrides, and fallback on garbage / non-positive env values.
- Extended `service/src/services/one-shot-command-runner.spec.ts` — install and build calls serialize when their pool is capped to 1, and the install / build pools are independent (one install + one build run together). `withContext` now accepts a `setup(injector)` hook so tests can rebind operation limits before resolving the service.
- Updated `service/src/app-models/github-repositories/actions/validate-repo-action.spec.ts` and `service/src/app-models/prerequisites/actions/check-prerequisite-action.spec.ts` — replaced the `vi.mock('child_process')` + `vi.mock('util')` execFile mocks with mocks of `runCli` / a stubbed `GitService.lsRemote` so the specs follow the new abstraction layer.
