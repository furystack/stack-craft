<!-- version-type: patch -->
# common

## ✨ Features

### Git Status Tracking

Extended `ServiceGitStatus` with fields for detecting out-of-sync clones without persisting state to the database:

- `upstreamStatus: 'present' | 'gone' | 'unknown'` — whether `origin/<currentBranch>` still exists on the remote
- `worktreeStatus: 'clean' | 'dirty' | 'conflicts' | 'unknown'` — derived from `git status --porcelain`
- `commitsBehind` — number of commits the local branch is behind `origin/<currentBranch>`
- `lastPullError` — last pull error message on an already-cloned repo; cleared on successful pull
- `warningsDismissed` — per-session flags for user-dismissed inline warnings (`upstreamGone`, `stale`)

### Stale Pipeline States

Added `'stale'` to both `InstallStatus` and `BuildStatus` so the UI can flag installs/builds that were invalidated by an external git change (branch switch or external pull performed outside the app).

### State History Events

Added new `ServiceStateEvent` values for external-origin transitions and a new trigger source:

- `external-branch-changed`, `external-pull-detected` — emitted when `.git/HEAD` or `refs/heads/*` change outside the app
- `upstream-gone` — emitted when a fetch-with-prune reveals the checked-out branch was removed from origin
- `marked-stale` — emitted when install/build are downgraded to `stale`
- New `TriggerSource: 'system'`

### Patch Runs

Added `PatchRun` model to record one-shot upgrade operations with idempotent re-runs. Each run tracks `patchId`, status (`running` / `success` / `failed` / `orphaned`), timestamps, and an append-only log of timestamped messages for audit purposes.

### New REST Endpoints

Added two POST endpoints on `ServicesApi`:

- `/services/:id/delete-branch` — deletes a local branch, optionally switching to `switchTo` (or the remote default) when the branch is currently checked out
- `/services/:id/dismiss-warning` — dismisses an inline warning (`'upstream-gone' | 'stale'`) for the service until the app is restarted

## 🧪 Tests

- Added `merge-service-view` tests covering the new `upstreamStatus`, `lastPullError`, and `warningsDismissed` fields

## ⬆️ Dependencies

- Bumped `@furystack/rest` from `^8.1.5` to `^9.0.0`
- Bumped `vitest` from `^4.1.4` to `^4.1.5`
