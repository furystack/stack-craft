<!-- version-type: patch -->
# service

## 🐛 Bug Fixes

### Unresolved `{{NAME}}` template placeholders are no longer a silent no-op on Apply

`POST /services/:id/apply-files` previously returned `applied: string[]` and silently left any unmatched `{{NAME}}` placeholder verbatim in the written file. Users editing stack environment variables and re-applying a file had no way to tell that interpolation had not happened (e.g. when a file template references `{{POSTGRES_USER}}` but the stack defines `TTC_MRK_POSTGRES_USER`).

The response shape is now `applied: AppliedServiceFile[]` where each entry carries `{ relativePath, unresolved: string[] }`. The new `unresolved` array lists every distinct placeholder that remained in the written content, in first-appearance order. Files are still written verbatim — the change is purely additive feedback so the caller can warn the user.

`GitOperationsService.applySharedFiles` (run as part of `cloneOrPullService` during setup / update) now logs a warning that lists per-file unresolved placeholders alongside the existing "Applied N file(s)" info line, surfacing the same mismatch during initial provisioning. The MCP `apply_service_files` / `apply_service_file` tools include the same list in their text result.

### Yarn prerequisite check now resolves on Windows

`checkYarn` previously called `execFile('yarn', ['--version'])`, which fails on Windows because Yarn is installed as a `yarn.cmd` / `yarn.ps1` shim — `execFile` does not consult `PATHEXT` and therefore reports the prerequisite as "not matched". On Windows the call is now routed through `cmd.exe /c yarn --version` so the shim is resolved like it is in any interactive shell. POSIX still uses `execFile` directly.

### Graceful service shutdown on Windows

`ProcessRunner.killProcessGroup` always invoked `taskkill /pid … /T /F` on Windows, regardless of the requested signal. Because `/F` is an unconditional force-kill, the SIGTERM-then-wait-then-SIGKILL escalation in `ServiceLifecycleManager` collapsed into a single force kill — managed services never received a chance to flush state on shutdown. The Windows branch now drops `/F` for non-`SIGKILL` signals and reserves it for `SIGKILL`, restoring the graceful-then-force escalation that POSIX already had.

## 🧪 Tests

- Added `apply-service-files` cases that assert the new `{ relativePath, unresolved }` shape on apply, including deduplication of repeated placeholders, propagation of partial resolution, and a standalone `collectUnresolvedPlaceholders` spec covering first-appearance order against the `{{NAME}}` pattern.
- Extended `service-file-manager` spec with a case that asserts unresolved placeholders are propagated from the apply util through the manager.
- Added a Windows-specific `killProcessGroup` spec asserting `taskkill` is invoked **without** `/F` for `SIGTERM` and **with** `/F` for `SIGKILL`.
- Replaced hard-coded `/tmp/...` literals in service specs with `os.tmpdir()`-based paths (`join(tmpdir(), '...')`) so spec runs are portable across Linux, macOS, and Windows. Affected specs: `git-operations-service`, `git-watcher`, `git-head-watcher`, `service-delete-branch-action`, `import-export-actions`, `create-stack-action`, `service-branches-action`, `resolve-service-cwd`, `encrypt-existing-secrets`, `service-pipeline-orchestrator`, `service-env-resolver`, `stale-state-reconciler`, `service-file-manager`, `service-checkout-action`, `check-prerequisite-action`, `evaluate-prerequisites`. The two `/tmp` references that remain in `process-runner.spec.ts` are intentional — they pair with explicit `process.platform = 'linux'` mocks that exercise the POSIX `'/bin/sh'` branch.
