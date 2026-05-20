<!-- version-type: patch -->
# service

## 🐛 Bug Fixes

### Yarn prerequisite check now resolves on Windows

`checkYarn` previously called `execFile('yarn', ['--version'])`, which fails on Windows because Yarn is installed as a `yarn.cmd` / `yarn.ps1` shim — `execFile` does not consult `PATHEXT` and therefore reports the prerequisite as "not matched". On Windows the call is now routed through `cmd.exe /c yarn --version` so the shim is resolved like it is in any interactive shell. POSIX still uses `execFile` directly.

### Graceful service shutdown on Windows

`ProcessRunner.killProcessGroup` always invoked `taskkill /pid … /T /F` on Windows, regardless of the requested signal. Because `/F` is an unconditional force-kill, the SIGTERM-then-wait-then-SIGKILL escalation in `ServiceLifecycleManager` collapsed into a single force kill — managed services never received a chance to flush state on shutdown. The Windows branch now drops `/F` for non-`SIGKILL` signals and reserves it for `SIGKILL`, restoring the graceful-then-force escalation that POSIX already had.

## 🧪 Tests

- Added a Windows-specific `killProcessGroup` spec asserting `taskkill` is invoked **without** `/F` for `SIGTERM` and **with** `/F` for `SIGKILL`.
- Replaced hard-coded `/tmp/...` literals in service specs with `os.tmpdir()`-based paths (`join(tmpdir(), '...')`) so spec runs are portable across Linux, macOS, and Windows. Affected specs: `git-operations-service`, `git-watcher`, `git-head-watcher`, `service-delete-branch-action`, `import-export-actions`, `create-stack-action`, `service-branches-action`, `resolve-service-cwd`, `encrypt-existing-secrets`, `service-pipeline-orchestrator`, `service-env-resolver`, `stale-state-reconciler`, `service-file-manager`, `service-checkout-action`, `check-prerequisite-action`, `evaluate-prerequisites`. The two `/tmp` references that remain in `process-runner.spec.ts` are intentional — they pair with explicit `process.platform = 'linux'` mocks that exercise the POSIX `'/bin/sh'` branch.
