<!-- version-type: patch -->
# service

## ✨ Features

### Patcher Subsystem

Added a patcher that runs one-shot upgrade operations on startup with idempotency and crash recovery:

- `runPatch()` — skips patches that already have a `success` entry in `PatchRun`; retries previously failed or orphaned ones; transitions the run from `running` to `success`/`failed` while capturing timestamped log messages
- `checkForOrphanedPatch()` — transitions any `PatchRun` rows stuck in `running` (from a previous crash) to `orphaned` so the patch is retried on the next startup
- `PatchRunStore` — typed data store for `PatchRun` entries with auto-generated ids
- `setupPatcher()` — wires the patcher into app startup and executes the registered patch list

First shipped patch: `0001-add-stale-status-enum` — migrates legacy `ServiceStatus` rows so the new `'stale'` values are valid for `installStatus` and `buildStatus`.

### External Git Change Detection

`GitHeadWatcher` now uses `chokidar` to watch both `.git/HEAD` and `.git/refs/heads/` for each cloned service (with recursive depth and `awaitWriteFinish` debouncing) and emits a typed `externalChange` event that distinguishes `branch-switched` (HEAD ref changed) from `pull-detected` (branch ref advanced):

```typescript
type GitHeadChangeEvent = {
  serviceId: string
  previousBranch?: string
  currentBranch?: string
  previousSha?: string
  currentSha?: string
  kind: 'branch-switched' | 'pull-detected' | 'unknown'
}
```

Added `ExternalGitChangeListener` that subscribes to these events, appends the matching `external-branch-changed` / `external-pull-detected` entry to `ServiceStateHistory`, and downgrades `installStatus`/`buildStatus` from `installed`/`built` to `'stale'` (emitting a `marked-stale` history event).

### Upstream-Gone Detection

`GitOperationsService.cloneOrPullService()` now runs `git fetch --prune` before pulling and checks whether `origin/<currentBranch>` still exists. When the upstream is gone it:

- Sets `ServiceGitStatus.upstreamStatus = 'gone'`
- Records an `upstream-gone` history event
- Keeps `cloneStatus = 'cloned'` (the repo is still usable) and returns `{ upstreamGone: true }`

Pull errors on an already-cloned repo are now surfaced via `ServiceGitStatus.lastPullError` instead of regressing `cloneStatus` to `'failed'`, so the branch selector in the UI stays usable.

### New Git Actions

- `ServiceDeleteBranchAction` (`POST /services/:id/delete-branch`) — deletes a local branch; when it is currently checked out, switches to `switchTo` or the remote default branch first, then clears the cached `upstream-gone` marker
- `ServiceDismissWarningAction` (`POST /services/:id/dismiss-warning`) — records a per-session dismissal flag (`upstreamGone` or `stale`) in the in-memory `ServiceGitStatus`

### GitService Additions

Added helper methods used by the above features:

- `fetch(cwd)` — `git fetch --prune`
- `hasRemoteBranch(cwd, branch)` — checks for `refs/remotes/origin/<branch>`
- `getDefaultBranch(cwd)` — resolves `origin/HEAD`
- `deleteLocalBranch(cwd, branch, force)` — `git branch -d` / `-D`
- `revParse(cwd, ref)` — returns the SHA of a ref (used to detect pull-advances)
- `getCommitsBehind(cwd, branch)` — count of commits the local branch is behind origin

## 🧪 Tests

- Added `run-patch.spec.ts` and `check-for-orphaned-patch.spec.ts` covering idempotent re-runs, retry of failed patches, and orphan recovery
- Added `external-git-change-listener.spec.ts` covering history recording and stale-marking for both `branch-switched` and `pull-detected` kinds
- Added `service-delete-branch-action.spec.ts` covering checkout-before-delete, forced delete, and upstream cleanup
- Added `service-dismiss-warning-action.spec.ts` covering both warning kinds
- Expanded `git-head-watcher.spec.ts` for the chokidar-based watcher and the new `externalChange` event shape
- Expanded `git-operations-service.spec.ts` for upstream-gone detection and the `lastPullError` behavior
- Expanded `git-service.spec.ts` for `fetch`, `hasRemoteBranch`, `deleteLocalBranch`, and `revParse`
- Expanded `git-watcher.spec.ts` for the new status fields

## ⬆️ Dependencies

- Added `chokidar` `^5.0.0` for reliable recursive filesystem watching on `.git/refs/heads/`
- Bumped `@furystack/rest-service` from `^12.3.5` to `^13.0.0`
- Bumped `@furystack/entity-sync-service` from `^1.0.12` to `^1.0.13`
- Bumped `@furystack/websocket-api` from `^13.2.7` to `^13.2.8`
- Bumped `vitest` from `^4.1.4` to `^4.1.5`
