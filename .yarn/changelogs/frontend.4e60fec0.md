<!-- version-type: patch -->
# frontend

## ✨ Features

### Inline Service Warnings

Added `ServiceWarnings` component that renders row-level actionable warnings inside the service table:

- **`upstream-gone`** — branch was removed from origin; offers "Delete local" (switches to the default branch then deletes the local branch) and "Dismiss" (session-scoped)
- **`stale`** — install/build fell out of sync with the current working tree after an external git change; offers "Rebuild" (runs the update pipeline) and "Dismiss"

### Branch Selector Enhancements

`BranchSelector` now consumes the full clone lifecycle via `cloneStatus` (instead of a boolean `isCloned`), visualizes `upstream-gone` with a warning-colored border and a `title` tooltip, and surfaces `lastPullError` in the tooltip so a failed pull is discoverable without leaving the table.

### Unified Logs View

The dedicated `/logs` and `/logs/:processUid` routes have been replaced by the existing Service Detail `Logs` tab with a `?processUid=` query parameter. The tab auto-selects when a process UID is present so "View process logs" from History stays inside the detail page.

## ♻️ Refactoring

### `@furystack/shades` v14 Routing Migration

Migrated all routing call sites to the new `NestedRoute` API:

- `StackCraftNestedRouteLink` now takes `path` instead of `href`
- `stackCraftNavigate` takes a single options object `{ path, params, query?, hash? }` instead of `(path, params)` positional arguments
- Added `stackCraftReplace` (created from the new `createNestedReplace` factory) for hash-only navigation without history entries
- `/stacks/:stackName/services/:serviceId` now declares its allowed `hash` values (`'overview' | 'logs' | 'history' | 'files' | 'configuration'`) and validates the `processUid` query parameter

### Service Detail Tab Sync

`ServiceDetail` now subscribes to `locationService.onLocationHashChanged` via `useObservable` (instead of reading a one-shot value into `useState`), so the active tab always matches the URL hash. Tab clicks call `stackCraftReplace` with the new hash, keeping browser history clean. When a `processUid` query is present the tab defaults to `'logs'`.

## 🗑️ Deprecated

- Removed the standalone `ServiceLogs` page (`/stacks/:stackName/services/:serviceId/logs` and `/logs/:processUid`). Link callers should point at `/stacks/:stackName/services/:serviceId` with `hash: 'logs'` and `query: { processUid }`.

## ⬆️ Dependencies

- Bumped `@furystack/shades` from `^13.2.2` to `^14.0.0`
- Bumped `@furystack/shades-common-components` from `^15.2.0` to `^16.0.0`
- Bumped `@furystack/shades-mfe` from `^3.0.6` to `^4.0.0`
- Bumped `@furystack/rest-client-fetch` from `^8.1.7` to `^8.1.8`
- Bumped `vite` from `^8.0.9` to `^8.0.10`
- Bumped `vitest` from `^4.1.4` to `^4.1.5`
